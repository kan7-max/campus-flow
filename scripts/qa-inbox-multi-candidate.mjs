import { readFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.TASKFLOW_QA_BASE_URL ?? "http://localhost:3000";
const storePath = path.join(process.cwd(), ".taskflow-demo-store.json");
const stamp = `IBXQA${Date.now().toString().slice(-6)}`;
const now = new Date();

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatJapaneseDate(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function toDateTimeLocal(value) {
  if (!value) {
    throw new Error("Candidate dueAt is missing.");
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid dueAt: ${value}`);
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function logPass(message) {
  console.log(`[PASS] ${message}`);
}

async function requestText(pathname, init) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${pathname} failed: ${response.status}`);
  }

  return { response, text };
}

async function postForm(pathname, formData) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    body: formData,
    headers: {
      origin: baseUrl
    },
    method: "POST",
    redirect: "manual"
  });

  if (![200, 303].includes(response.status)) {
    const text = await response.text();
    throw new Error(`POST ${pathname} failed: ${response.status} ${text.slice(0, 500)}`);
  }

  const location = response.headers.get("location");
  if (location) {
    await requestText(location.startsWith("http") ? new URL(location).pathname + new URL(location).search : location);
  }

  return location;
}

async function readStore() {
  return JSON.parse(await readFile(storePath, "utf8"));
}

function getInboxCandidates(item) {
  return [item.parsedPayload, ...(item.parsedPayload?.alternativeCandidates ?? [])].filter(Boolean);
}

function getSavedCandidateCount(item) {
  return Object.keys(item.parsedPayload?.savedCandidateAssignmentIds ?? {}).length;
}

async function findInboxItem() {
  const store = await readStore();
  const item = store.inboxItems.find((current) => current.rawText?.includes(stamp));
  assert(item, `Could not find inbox item for ${stamp}.`);
  return { item, store };
}

function extractParseActionName(html) {
  const match = html.match(/<button[^>]*name="(\$ACTION_ID_[^"]+)"[^>]*>[\s\S]*?課題候補に整理<\/button>/);
  assert(match?.[1], "Could not find parse Server Action id.");
  return match[1];
}

function extractCandidateSaveActionName(html, itemId, candidateIndex) {
  const formMatch = Array.from(html.matchAll(/<form[^>]*>[\s\S]*?<\/form>/g)).find((match) => {
    const form = match[0];
    return form.includes(`name="itemId" value="${itemId}"`) && form.includes(`name="candidateIndex" value="${candidateIndex}"`);
  });
  assert(formMatch?.[0], `Could not find candidate ${candidateIndex} form.`);

  const actionMatch = formMatch[0].match(/name="(\$ACTION_ID_[^"]+)"/);
  assert(actionMatch?.[1], `Could not find candidate ${candidateIndex} save Server Action id.`);
  return actionMatch[1];
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
      const detailHtml = (await requestText(`/assignments/${assignment.id}`)).text;
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

const sourceText = [
  `物理実験 ${stamp} 今日反映実験レポート ${formatJapaneseDate(now)} 23:59まで。WebClass提出。グラフと考察が必要。`,
  `英語コミュニケーション ${stamp} Unit 4課題 ${formatJapaneseDate(addDays(now, 1))} 18:00まで。LMS提出。`,
  `線形代数 ${stamp} 小テスト準備 ${formatJapaneseDate(addDays(now, 2))} 09:00まで。範囲を確認して例題を解く。`
].join("\n");

const inboxHtml = (await requestText("/inbox")).text;
const parseActionName = extractParseActionName(inboxHtml);
const parseFormData = new FormData();
parseFormData.append(parseActionName, "");
parseFormData.append("rawText", sourceText);
parseFormData.append("sourceType", "manual_text");

await postForm("/inbox", parseFormData);

let { item } = await findInboxItem();
let candidates = getInboxCandidates(item);
assert(item.status === "parsed", `Expected parsed item, got ${item.status}.`);
assert(item.rawText.includes(stamp), "raw_text was not preserved after parsing.");
assert(candidates.length >= 3, `Expected at least 3 inbox candidates, got ${candidates.length}.`);
assert(getSavedCandidateCount(item) === 0, "Expected no saved candidates before saving.");
logPass(`parsed inbox item with ${candidates.length} candidates`);

const savedAssignments = [];
let currentStore;

for (let index = 0; index < 3; index += 1) {
  const currentHtml = (await requestText("/inbox")).text;
  ({ item } = await findInboxItem());
  candidates = getInboxCandidates(item);
  const candidate = candidates[index];
  assert(candidate, `Missing candidate ${index}.`);

  const saveActionName = extractCandidateSaveActionName(currentHtml, item.id, index);
  const saveFormData = new FormData();
  saveFormData.append(saveActionName, "");
  saveFormData.append("itemId", item.id);
  saveFormData.append("candidateIndex", String(index));
  saveFormData.append("title", candidate.title);
  saveFormData.append("courseId", "");
  saveFormData.append("assignmentType", candidate.assignmentType);
  saveFormData.append("dueAt", toDateTimeLocal(candidate.dueAt));
  saveFormData.append("submissionTarget", candidate.submissionTarget ?? "");
  saveFormData.append("estimatedHours", String(candidate.estimatedHours ?? 1));
  saveFormData.append("memo", candidate.memo ?? sourceText);
  saveFormData.append("suggestedSubtasks", (candidate.suggestedSubtasks ?? []).join("\n"));
  if (candidate.isHeavy) saveFormData.append("isHeavy", "on");
  if ((candidate.tags ?? []).includes("quick")) saveFormData.append("tagQuick", "on");

  await postForm("/inbox", saveFormData);

  ({ item, store: currentStore } = await findInboxItem());
  const savedIds = item.parsedPayload?.savedCandidateAssignmentIds ?? {};
  const assignmentId = savedIds[index];
  assert(assignmentId, `Candidate ${index} did not record saved assignment id.`);
  const assignment = currentStore.assignments.find((current) => current.id === assignmentId);
  assert(assignment, `Saved assignment ${assignmentId} not found in demo store.`);
  savedAssignments.push({ id: assignment.id, title: assignment.title });

  if (index < 2) {
    assert(item.status === "parsed", `Expected partial save to keep status parsed, got ${item.status}.`);
    assert(getSavedCandidateCount(item) === index + 1, `Expected ${index + 1} saved candidates.`);
  } else {
    assert(item.status === "saved", `Expected all candidates saved status, got ${item.status}.`);
    assert(getSavedCandidateCount(item) === 3, "Expected 3 saved candidates after full save.");
  }

  logPass(`saved candidate ${index + 1}`);
}

const assignmentHtml = (await requestText("/assignments")).text;
for (const assignment of savedAssignments) {
  assert(assignmentHtml.includes(assignment.title), `/assignments did not include ${assignment.title}.`);
}
logPass("/assignments reflects saved inbox candidates");

const todayHtml = (await requestText("/today")).text;
assert(todayHtml.includes("今日やること") || todayHtml.includes("今日のタイムライン"), "/today did not render expected content.");
if (todayHtml.includes(stamp)) {
  logPass("/today reflects saved inbox candidate");
} else {
  console.warn("[WARN] /today rendered, but the saved inbox QA assignments were outside the visible priority slots.");
}

for (const assignment of savedAssignments) {
  const detailHtml = (await requestText(`/assignments/${assignment.id}`)).text;
  assert(detailHtml.includes(assignment.title), `Detail page did not include ${assignment.title}.`);
}
logPass("detail pages render for saved inbox candidates");

const cleanedAssignmentIds = await cleanupSavedAssignments(savedAssignments);

console.log(
  JSON.stringify(
    {
      baseUrl,
      cleanedAssignmentIds,
      inboxItemId: item.id,
      savedAssignments,
      stamp
    },
    null,
    2
  )
);
