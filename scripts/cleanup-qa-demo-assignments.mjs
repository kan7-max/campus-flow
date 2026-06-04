import { readFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.TASKFLOW_QA_BASE_URL ?? "http://localhost:3000";
const storePath = path.join(process.cwd(), ".taskflow-demo-store.json");
const qaTitlePattern = /\b(?:MVPQA|IBXQA|UIQA)\d{6}\b/;

async function requestText(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${pathname} failed: ${response.status}`);
  }

  return text;
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
}

async function readStore() {
  return JSON.parse(await readFile(storePath, "utf8"));
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

const store = await readStore();
const targets = store.assignments.filter((assignment) => !assignment.deletedAt && qaTitlePattern.test(assignment.title ?? ""));
const deleted = [];
const skipped = [];

for (const assignment of targets) {
  try {
    const detailHtml = await requestText(`/assignments/${assignment.id}`);
    const actionName = extractDeleteActionName(detailHtml, assignment.id);

    if (!actionName) {
      skipped.push({ id: assignment.id, title: assignment.title, reason: "delete action not found" });
      continue;
    }

    const formData = new FormData();
    formData.append(actionName, "");
    formData.append("id", assignment.id);
    await postForm(`/assignments/${assignment.id}`, formData);
    deleted.push({ id: assignment.id, title: assignment.title });
  } catch (error) {
    skipped.push({
      id: assignment.id,
      title: assignment.title,
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      deletedCount: deleted.length,
      deleted,
      skipped
    },
    null,
    2
  )
);
