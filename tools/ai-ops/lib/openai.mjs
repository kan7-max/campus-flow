import { getEnv, requireEnv } from "./env.js";

function extractText(responseJson) {
  if (typeof responseJson?.output_text === "string" && responseJson.output_text.trim()) {
    return responseJson.output_text.trim();
  }
  const chunks = [];
  for (const item of responseJson?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

export async function callOpenAIText(systemPrompt, userPrompt, options = {}) {
  const result = await callOpenAITextDetailed(systemPrompt, userPrompt, options);
  return result.text;
}

export async function callOpenAITextDetailed(systemPrompt, userPrompt, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY || requireEnv("OPENAI_API_KEY");
  const endpoint = options.endpoint || getEnv("OPENAI_RESPONSES_URL", "https://api.openai.com/v1/responses");
  const model = options.model || getEnv("OPENAI_MODEL", "gpt-4.1-mini");
  const body = {
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: userPrompt }]
      }
    ]
  };
  if (Number.isFinite(Number(options.maxOutputTokens))) {
    body.max_output_tokens = Number(options.maxOutputTokens);
  }
  if (options?.metadata && typeof options.metadata === "object") {
    body.metadata = options.metadata;
  }
  if (options?.extraBody && typeof options.extraBody === "object") {
    Object.assign(body, options.extraBody);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const raw = await response.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    // preserve parse failure below
  }

  if (!response.ok) {
    const detail = json?.error?.message || raw || "unknown error";
    throw new Error(`OpenAI API ${response.status}: ${detail}`);
  }

  const text = extractText(json);
  if (!text) {
    throw new Error("OpenAI response had no text output.");
  }
  return {
    text,
    usage: json?.usage || null,
    raw: json
  };
}

