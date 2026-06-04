const baseUrl = process.env.TASKFLOW_EVAL_BASE_URL ?? "http://localhost:3000";

const fixtures = [
  {
    name: "lab report title prefers assignment name",
    text: [
      "物理実験",
      "AISmokeEval 実験レポートは2026/05/21 23:59まで。",
      "グラフと考察を提出。提出先はWebClass。"
    ].join("\n"),
    expected: [
      {
        titleIncludes: "AISmokeEval 実験レポート",
        courseName: "物理実験",
        assignmentType: "lab_report",
        dueDate: "2026-05-21",
        submissionTarget: "WebClass"
      }
    ]
  },
  {
    name: "long text splits multiple candidates",
    text: [
      "WebClass 物理実験",
      "物理実験レポートは2026/05/23 23:59まで。グラフ作成と考察が必要。提出先はWebClass。",
      "英語コミュニケーション Unit 8課題は2026/05/24 18:00まで。問題を解いて提出。",
      "情報リテラシー発表資料は2026/05/26 09:00まで。スライドと発表原稿を準備。"
    ].join("\n"),
    expected: [
      {
        titleIncludes: "物理実験レポート",
        courseName: "物理実験",
        assignmentType: "lab_report",
        dueDate: "2026-05-23"
      },
      {
        titleIncludes: "Unit 8課題",
        courseName: "英語コミュニケーション",
        dueDate: "2026-05-24"
      },
      {
        titleIncludes: "発表資料",
        courseName: "情報リテラシー",
        assignmentType: "presentation",
        dueDate: "2026-05-26"
      }
    ]
  },
  {
    name: "quiz and presentation are classified",
    text: [
      "応用数学 小テストは2026/05/27 09:00に実施。範囲は1階線形微分方程式。",
      "英語プレゼン 発表資料は2026/05/28 18:00まで。スライドと原稿をGoogle Classroomへ提出。"
    ].join("\n"),
    expected: [
      {
        titleIncludes: "小テスト",
        courseName: "応用数学",
        assignmentType: "quiz",
        dueDate: "2026-05-27"
      },
      {
        titleIncludes: "発表資料",
        courseName: "英語プレゼン",
        assignmentType: "presentation",
        dueDate: "2026-05-28",
        submissionTarget: "Google Classroom"
      }
    ]
  },
  {
    name: "missing due date remains confirmable",
    text: "情報リテラシー 小レポートは次回授業まで。提出先はWebClass。テーマを確認しておく。",
    expected: [
      {
        titleIncludes: "小レポート",
        courseName: "情報リテラシー",
        dueAtNull: true,
        submissionTarget: "WebClass"
      }
    ]
  },
  {
    name: "qa heading and event follow-up are not separate assignments",
    text: [
      "MVP最終QA0506 複数課題確認",
      "物理実験 課題名: 電気回路 実験レポート 締切: 5/12 23:59 提出先: WebClass グラフ作成と考察が必要。",
      "英語コミュニケーション Unit 9 の問題を5/13 10:00までにGoogle Classroomへ提出。",
      "情報リテラシー 発表資料を5/15 18:00までにTeamsへ提出。発表は5/16の授業内。"
    ].join("\n"),
    expected: [
      {
        titleIncludes: "電気回路 実験レポート",
        courseName: "物理実験",
        assignmentType: "lab_report",
        dueDate: "2026-05-12"
      },
      {
        titleIncludes: "Unit 9",
        courseName: "英語コミュニケーション",
        dueDate: "2026-05-13"
      },
      {
        titleIncludes: "発表資料",
        courseName: "情報リテラシー",
        assignmentType: "presentation",
        dueDate: "2026-05-15"
      }
    ],
    unexpectedTitleIncludes: ["MVP最終QA0506", "発表は"]
  },
  {
    name: "title may include due-like words",
    text: "物理実験 課題名: InboxQA0506E 明日締切チェックレポート 締切: 5/7 23:59 提出先: WebClass 考察を短くまとめる。",
    expected: [
      {
        titleIncludes: "InboxQA0506E 明日締切チェックレポート",
        courseName: "物理実験",
        assignmentType: "report",
        dueDate: "2026-05-07",
        submissionTarget: "WebClass"
      }
    ]
  }
];

function formatCandidate(candidate) {
  return `${candidate.title} | ${candidate.courseName ?? "-"} | ${candidate.assignmentType} | ${candidate.dueAt ?? "-"}`;
}

function matchesExpectation(candidate, expected) {
  if (expected.titleIncludes && !candidate.title.includes(expected.titleIncludes)) return false;
  if (expected.courseName && candidate.courseName !== expected.courseName) return false;
  if (expected.assignmentType && candidate.assignmentType !== expected.assignmentType) return false;
  if (expected.dueDate && !candidate.dueAt?.startsWith(expected.dueDate)) return false;
  if (expected.dueAtNull && candidate.dueAt !== null) return false;
  if (expected.submissionTarget && candidate.submissionTarget !== expected.submissionTarget) return false;
  return true;
}

async function evaluateFixture(fixture) {
  const response = await fetch(`${baseUrl}/api/ai/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sourceType: "chat",
      text: fixture.text,
      timezone: "Asia/Tokyo"
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${fixture.name}: API returned ${response.status}: ${text}`);
  }

  const result = await response.json();
  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  const failures = fixture.expected.filter(
    (expected) => !candidates.some((candidate) => matchesExpectation(candidate, expected))
  );
  const unexpected = (fixture.unexpectedTitleIncludes ?? []).filter((titlePart) =>
    candidates.some((candidate) => candidate.title.includes(titlePart))
  );

  return {
    candidates,
    failures,
    unexpected,
    fixture
  };
}

let failed = false;

for (const fixture of fixtures) {
  const result = await evaluateFixture(fixture);
  console.log(`\n[${result.failures.length === 0 && result.unexpected.length === 0 ? "PASS" : "FAIL"}] ${fixture.name}`);
  for (const candidate of result.candidates) {
    console.log(`  - ${formatCandidate(candidate)}`);
  }

  if (result.failures.length > 0 || result.unexpected.length > 0) {
    failed = true;
  }

  if (result.failures.length > 0) {
    console.log("  Missing expectations:");
    for (const expectation of result.failures) {
      console.log(`  - ${JSON.stringify(expectation)}`);
    }
  }

  if (result.unexpected.length > 0) {
    console.log("  Unexpected title fragments:");
    for (const titlePart of result.unexpected) {
      console.log(`  - ${titlePart}`);
    }
  }
}

if (failed) {
  process.exitCode = 1;
}
