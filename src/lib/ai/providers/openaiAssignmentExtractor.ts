import OpenAI from "openai";
import { env } from "@/lib/env";
import type { AssignmentExtractor, ExtractorInput } from "@/lib/ai/types";
import type { AiExtractionResult } from "@/lib/types/domain";

const extractionSchema = {
  name: "assignment_extract_result",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      candidates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            courseName: { type: ["string", "null"] },
            dueAt: { type: ["string", "null"] },
            submissionTarget: { type: ["string", "null"] },
            assignmentType: {
              type: "string",
              enum: ["report", "quiz", "homework", "presentation", "lab_report", "exam", "other"]
            },
            memo: { type: ["string", "null"] },
            priorityLabel: { type: "string", enum: ["high", "medium", "low"] },
            estimatedHours: { type: "number" },
            isHeavy: { type: "boolean" },
            tags: {
              type: "array",
              items: {
                type: "string",
                enum: ["heavy", "quick"]
              }
            },
            confidence: { type: "number" },
            suggestedSubtasks: {
              type: "array",
              items: { type: "string" }
            },
            studyPlan: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: [
            "title",
            "courseName",
            "dueAt",
            "submissionTarget",
            "assignmentType",
            "memo",
            "priorityLabel",
            "estimatedHours",
            "isHeavy",
            "tags",
            "confidence",
            "suggestedSubtasks",
            "studyPlan"
          ],
          additionalProperties: false
        }
      }
    },
    required: ["summary", "candidates"],
    additionalProperties: false
  }
} as const;

export class OpenAiAssignmentExtractor implements AssignmentExtractor {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, maxRetries: 0 });
  }

  private removeNoiseLines(text: string) {
    const noisePattern =
      /^(?:ホーム|戻る|一覧|シラバス|お知らせ|通知|ログアウト|ログイン|メニュー|検索|前へ|次へ|保存|キャンセル|編集|削除|詳細|未読|既読|トップ|ページ上部|ページトップ|course|dashboard|loading|more|close|open)$/i;

    return text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.trim().replace(/\s+/g, " "))
      .filter((line) => line.length > 0 && !noisePattern.test(line))
      .map((line) => (line.length > 260 ? `${line.slice(0, 260)}...` : line));
  }

  private compactLongLmsText(text: string) {
    const lines = this.removeNoiseLines(text);
    if (lines.length <= 150) {
      return lines.join("\n");
    }

    const priorityPattern =
      /課題|宿題|レポート|実験|小テスト|確認テスト|テスト|試験|発表|プレゼン|提出|締切|〆切|締め切り|期限|期日|まで|WebClass|Classroom|Moodle|manaba|Unit|Chapter|assignment|homework|submission|report|quiz|exam|presentation|worksheet/i;
    const courseContextPattern =
      /科目名|授業名|講義名|コース|授業|科目|Course|Class|英語|物理|数学|情報|統計|化学|電磁気|線形|微分|積分/i;

    const priorityIndexes = lines
      .map((line, index) => (priorityPattern.test(line) ? index : -1))
      .filter((index) => index >= 0);

    const selectedIndexes = new Set<number>();

    for (const index of priorityIndexes) {
      // Keep nearby lines because WebClass often splits course, deadline, target and title across rows.
      for (let offset = -2; offset <= 3; offset += 1) {
        const nextIndex = index + offset;
        if (nextIndex >= 0 && nextIndex < lines.length) {
          selectedIndexes.add(nextIndex);
        }
      }
    }

    lines.forEach((line, index) => {
      if (courseContextPattern.test(line) && line.length <= 80) {
        selectedIndexes.add(index);
        if (index + 1 < lines.length && priorityPattern.test(lines[index + 1])) {
          selectedIndexes.add(index + 1);
        }
      }
    });

    const headLines = lines.slice(0, 40).map((_, index) => index);
    const tailLines = lines.slice(-20).map((_, index) => lines.length - 20 + index);
    [...headLines, ...tailLines].forEach((index) => selectedIndexes.add(index));

    const ordered = Array.from(selectedIndexes)
      .filter((index) => index >= 0 && index < lines.length)
      .sort((left, right) => left - right)
      .map((index) => lines[index]);

    const seen = new Set<string>();
    const unique: string[] = [];

    for (const line of ordered) {
      const key = line.toLowerCase().replace(/\s+/g, "");
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(line);
      if (unique.length >= 180) {
        break;
      }
    }

    return unique.join("\n");
  }

  private toPromptText(text: string) {
    const compactText = this.compactLongLmsText(text);
    const maxChars = 9_000;
    if (compactText.length <= maxChars) {
      return compactText;
    }

    const head = compactText.slice(0, 6_100);
    const tail = compactText.slice(-2_200);
    return `${head}\n...\n[省略: LMS本文の中間部]\n...\n${tail}`;
  }

  private chooseMaxTokens(promptText: string) {
    const signalCount =
      (promptText.match(/課題|宿題|レポート|実験|小テスト|確認テスト|試験|発表|提出|Unit|Chapter|assignment|homework|submission|report|quiz|exam|presentation/gi) ?? []).length;

    if (promptText.length > 7600) {
      return 1800;
    }

    if (signalCount >= 8) {
      return 1650;
    }

    if (promptText.length > 4200) {
      return 1350;
    }

    return 980;
  }

  private countJapaneseChars(text: string) {
    return (text.match(/[ぁ-んァ-ヶ一-龠々〆ヵヶ]/g) ?? []).length;
  }

  private countLatinChars(text: string) {
    return (text.match(/[A-Za-z]/g) ?? []).length;
  }

  private shouldPreferJapaneseOutput(sourceText: string) {
    const japanese = this.countJapaneseChars(sourceText);
    const latin = this.countLatinChars(sourceText);
    return japanese >= 10 && japanese >= latin;
  }

  private tokenizeTitle(title: string) {
    return title
      .replace(/[【】\[\]()（）:：,，.。]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
      .slice(0, 4);
  }

  private buildJapaneseMemoFromSource(sourceText: string, title: string) {
    const lines = sourceText
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return null;
    }

    const tokens = this.tokenizeTitle(title);
    const matchedIndexes = new Set<number>();

    if (tokens.length > 0) {
      lines.forEach((line, index) => {
        const hit = tokens.some((token) => line.includes(token));
        if (hit) {
          matchedIndexes.add(index);
        }
      });
    }

    const pick = new Set<number>();
    for (const index of matchedIndexes) {
      pick.add(index);
      if (index + 1 < lines.length) {
        pick.add(index + 1);
      }
    }

    if (pick.size === 0) {
      lines.forEach((line, index) => {
        if (/締切|期限|提出|課題|レポート|小テスト|発表|実験/.test(line)) {
          pick.add(index);
        }
      });
    }

    const selected = Array.from(pick)
      .sort((a, b) => a - b)
      .map((index) => lines[index])
      .filter((line) => this.countJapaneseChars(line) > 0)
      .slice(0, 2);

    if (selected.length === 0) {
      return null;
    }

    const memo = selected.join(" / ").replace(/\s+/g, " ").trim();
    return memo.length > 240 ? `${memo.slice(0, 240)}...` : memo;
  }

  private sanitizeJapaneseMemo(memo: string | null, title: string, sourceText: string) {
    if (!memo) {
      return this.buildJapaneseMemoFromSource(sourceText, title);
    }

    const japaneseChars = this.countJapaneseChars(memo);
    const latinChars = this.countLatinChars(memo);
    const looksEnglishHeavy = japaneseChars === 0 && latinChars >= 8;

    if (!looksEnglishHeavy) {
      return memo;
    }

    return this.buildJapaneseMemoFromSource(sourceText, title) ?? "要件は原文で確認してください。";
  }

  async extract(input: ExtractorInput): Promise<AiExtractionResult> {
    const promptText = this.toPromptText(input.text);
    const maxTokens = this.chooseMaxTokens(promptText);
    const preferJapaneseOutput = this.shouldPreferJapaneseOutput(input.text);
    const completion = await this.client.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0,
      max_tokens: maxTokens,
      messages: [
        {
          role: "system",
          content:
            "You extract university assignment candidates from Japanese/English LMS text. "
            + "Goal: maximize useful assignment recall without turning plain announcements or class topics into fake tasks. "
            + "Extract only actionable student tasks: reports, homework, worksheets, quizzes, exams, presentations, reaction papers, file submissions, preparation/review tasks with explicit instructions. "
            + "Do not extract simple lecture titles, navigation text, materials-only notices, attendance notes, or teacher announcements unless they require a student submission/action. "
            + "Split independent assignments into separate candidates, even when they are in one paragraph or table. Do not merge unrelated tasks. "
            + "When multiple assignments exist, return all actionable items up to 24 candidates. "
            + "If course name appears in a nearby heading before several tasks, propagate it to those tasks. "
            + "Title must be the deliverable/task name such as '第3回レポート', 'Unit 5課題', '確認テスト', not an action phrase like '提出する' or a whole sentence. "
            + "dueAt must be ISO 8601. Use explicit submission deadline when present. For quiz/exam/presentation event date, use that date only when no separate submission deadline exists. "
            + "If only month/day is written, infer year using the provided timezone and current academic context. If only a date is written, use 23:59. Never invent a deadline. "
            + "submissionTarget should be WebClass, Moodle, Google Classroom, email, classroom, form, etc. Keep null if absent. "
            + "Set confidence lower when due date/course/target is missing or inferred from weak context. "
            + "Keep memo concise but include important requirements such as page range, file format, word count, or required graph/calculation. suggestedSubtasks/studyPlan max 4 each. "
            + "When the source text is mostly Japanese, output summary/memo/suggestedSubtasks/studyPlan in Japanese."
            + "Return only valid JSON in requested schema."
        },
        {
          role: "user",
          content: `timezone=${input.timezone}\nsourceType=${input.sourceType}\noriginalLength=${input.text.length}\n\nTEXT:\n${promptText}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: extractionSchema
      }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI response is empty");
    }

    const parsed = JSON.parse(content) as Omit<AiExtractionResult, "rawText">;
    const candidates = preferJapaneseOutput
      ? parsed.candidates.map((candidate) => ({
          ...candidate,
          memo: this.sanitizeJapaneseMemo(candidate.memo, candidate.title, input.text)
        }))
      : parsed.candidates;
    const summary = preferJapaneseOutput && this.countJapaneseChars(parsed.summary) === 0
      ? `候補を${candidates.length}件抽出しました。保存前に締切・授業名を確認してください。`
      : parsed.summary;

    return {
      summary,
      candidates,
      rawText: input.text
    };
  }
}
