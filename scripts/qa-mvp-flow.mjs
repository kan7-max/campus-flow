const baseUrl = process.env.TASKFLOW_QA_BASE_URL ?? "http://localhost:3000";
const stamp = `MVPQA${Date.now().toString().slice(-6)}`;
const now = new Date();

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatJapaneseDate(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

const today = formatJapaneseDate(now);
const tomorrow = formatJapaneseDate(addDays(now, 1));
const dayAfterTomorrow = formatJapaneseDate(addDays(now, 2));

const sourceText = [
  `物理実験 ${stamp} 今日反映実験レポート ${today} 23:59まで。WebClass提出。グラフと考察が必要。`,
  `英語コミュニケーション ${stamp} Unit 12課題 ${tomorrow} 18:00まで。Teams提出。`,
  `情報リテラシー ${stamp} 発表資料 ${dayAfterTomorrow} 09:00まで。発表スライドを作成。`
].join("\n");

async function requestJson(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
}

async function requestText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`);
  }

  return text;
}

async function postForm(path, formData) {
  const response = await fetch(`${baseUrl}${path}`, {
    body: formData,
    headers: {
      origin: baseUrl
    },
    method: "POST",
    redirect: "manual"
  });

  if (![200, 303].includes(response.status)) {
    const text = await response.text();
    throw new Error(`POST ${path} failed: ${response.status} ${text.slice(0, 500)}`);
  }

  const location = response.headers.get("location");
  if (location) {
    await requestText(location.startsWith("http") ? new URL(location).pathname + new URL(location).search : location);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function logPass(message) {
  console.log(`[PASS] ${message}`);
}

function extractDeleteActionName(html, assignmentId) {
  const formMatch = Array.from(html.matchAll(/<form[^>]*>[\s\S]*?<\/form>/g)).find((match) => {
    const form = match[0];
    return form.includes(`name="id" value="${assignmentId}"`) && form.includes(">削除</button>");
  });

  if (!formMatch?.[0]) {
    return null;
  }

  return formMatch[0].match(/name="(\$ACTION_ID_[^"]+)"/)?.[1] ?? null;
}

async function cleanupSavedAssignments(assignments) {
  const deleted = [];

  for (const assignment of assignments) {
    try {
      const detailHtml = await requestText(`/assignments/${assignment.id}`);
      const actionName = extractDeleteActionName(detailHtml, assignment.id);
      if (!actionName) {
        console.warn(`[WARN] cleanup skipped for ${assignment.title}: delete action not found`);
        continue;
      }

      const formData = new FormData();
      formData.append(actionName, "");
      formData.append("id", assignment.id);
      await postForm(`/assignments/${assignment.id}`, formData);
      deleted.push(assignment.id);
    } catch (error) {
      console.warn(
        `[WARN] cleanup failed for ${assignment.title}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (deleted.length > 0) {
    logPass(`cleaned up ${deleted.length} QA assignments`);
  }

  return deleted;
}

const extraction = await requestJson("/api/ai/extract", {
  method: "POST",
  body: JSON.stringify({
    sourceType: "chat",
    text: sourceText,
    timezone: "Asia/Tokyo"
  })
});

assert(Array.isArray(extraction.candidates), "Extraction response did not include candidates.");
assert(extraction.candidates.length >= 2, `Expected multiple candidates, got ${extraction.candidates.length}.`);
logPass(`extracted ${extraction.candidates.length} candidates`);

const selectedCandidates = extraction.candidates.filter((candidate) => candidate.dueAt).slice(0, 2);
assert(selectedCandidates.length >= 2, "Expected at least two candidates with due dates to save.");

const saveResult = await requestJson("/api/ai/save", {
  method: "POST",
  body: JSON.stringify({
    sourceType: "chat",
    sourceText,
    candidates: selectedCandidates
  })
});

assert(saveResult.savedCount >= 2, `Expected at least 2 saved assignments, got ${saveResult.savedCount}.`);
assert(Array.isArray(saveResult.savedAssignments), "Save response did not include saved assignment links.");
logPass(`saved ${saveResult.savedCount} assignments`);

const assignmentHtml = await requestText("/assignments");
for (const assignment of saveResult.savedAssignments) {
  assert(assignmentHtml.includes(assignment.title), `/assignments did not include ${assignment.title}.`);
}
logPass("/assignments reflects saved assignments");

const todayHtml = await requestText("/today");
assert(todayHtml.includes("今日やること") || todayHtml.includes("今日のタイムライン"), "/today did not render expected content.");
if (saveResult.savedAssignments.some((assignment) => todayHtml.includes(assignment.title))) {
  logPass("/today reflects at least one saved assignment");
} else {
  console.warn("[WARN] /today rendered, but the saved QA assignments were outside the visible priority slots.");
}

const detailChecks = await Promise.all(
  saveResult.savedAssignments.slice(0, 2).map(async (assignment) => {
    const detailHtml = await requestText(`/assignments/${assignment.id}`);
    assert(detailHtml.includes(assignment.title), `Assignment detail did not include ${assignment.title}.`);
    return assignment.title;
  })
);
logPass(`detail pages render: ${detailChecks.join(", ")}`);

const cleanedAssignmentIds = await cleanupSavedAssignments(saveResult.savedAssignments);

console.log(
  JSON.stringify(
    {
      baseUrl,
      cleanedAssignmentIds,
      extractedCount: extraction.candidates.length,
      savedAssignments: saveResult.savedAssignments,
      stamp
    },
    null,
    2
  )
);
