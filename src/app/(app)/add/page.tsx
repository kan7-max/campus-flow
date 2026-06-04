import Link from "next/link";
import { BookOpen, Bot, ClipboardPaste, FileText, Inbox, PencilLine, Sparkles } from "lucide-react";

const addMethods = [
  {
    href: "/ai",
    title: "AI貼り付け",
    description: "WebClassやLMS文をAIで整理",
    badge: "おすすめ",
    icon: Sparkles,
    tone: "border-primary/35 bg-primary/10 text-primary"
  },
  {
    href: "/ai",
    title: "PDF・画像",
    description: "資料やスクショから抽出",
    badge: "資料",
    icon: FileText,
    tone: "border-warning/35 bg-warning/10 text-warning"
  },
  {
    href: "/assignments/new",
    title: "課題手入力",
    description: "1件ずつ確実に追加",
    badge: "確実",
    icon: PencilLine,
    tone: "border-success/35 bg-success/10 text-success"
  },
  {
    href: "/courses",
    title: "授業追加",
    description: "授業名・曜日・教室を登録",
    badge: "授業",
    icon: BookOpen,
    tone: "border-primary/30 bg-primary/5 text-primary"
  },
  {
    href: "/inbox",
    title: "Inboxメモ",
    description: "あとで整理するメモ置き場",
    badge: "後で",
    icon: Inbox,
    tone: "border-border bg-muted text-muted-foreground"
  },
  {
    href: "/ai",
    title: "長文整理",
    description: "複数課題をまとめて抽出",
    badge: "長文",
    icon: Bot,
    tone: "border-primary/30 bg-primary/5 text-primary"
  },
  {
    href: "/inbox",
    title: "一時保存",
    description: "急ぎで文章だけ保存",
    badge: "急ぎ",
    icon: ClipboardPaste,
    tone: "border-border bg-card text-foreground"
  }
];

export default function AddPage() {
  return (
    <div className="space-y-3 sm:space-y-5">
      <section className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary sm:text-xs">Add</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:mt-2 sm:text-2xl">追加方法を選ぶ</h1>
        <p className="mt-1 text-xs leading-5 text-muted-foreground sm:mt-2 sm:max-w-2xl sm:text-sm sm:leading-6">
          課題はAI入力、授業は授業追加から登録できます。
        </p>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
        {addMethods.map((method) => {
          const Icon = method.icon;
          return (
            <Link
              key={`${method.href}-${method.title}`}
              href={method.href}
              className="group flex min-h-[104px] flex-col rounded-xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-h-[164px] sm:p-4"
            >
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border sm:h-12 sm:w-12 sm:rounded-xl ${method.tone}`}>
                  <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
                </span>
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:px-2.5 sm:py-1 sm:text-xs">
                  {method.badge}
                </span>
              </div>

              <div className="mt-2 flex-1 sm:mt-4">
                <h2 className="text-sm font-semibold leading-5 text-foreground group-hover:text-primary sm:text-lg">{method.title}</h2>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
                  {method.description}
                </p>
              </div>

              <p className="mt-2 text-[11px] font-semibold text-primary sm:mt-4 sm:text-sm">追加する →</p>
            </Link>
          );
        })}
      </div>

      <section className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground sm:p-4 sm:text-sm">
        <p className="font-semibold text-foreground">迷ったら「AI貼り付け」がおすすめです。</p>
        <p className="mt-1 hidden sm:block">
          授業名を先に登録しておくと、AI抽出後の課題整理も見やすくなります。
        </p>
      </section>
    </div>
  );
}
