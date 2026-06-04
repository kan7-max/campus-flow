export default function AppLoading() {
  return (
    <div className="space-y-4" aria-label="読み込み中">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
        <div className="mt-4 h-7 w-64 max-w-full animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded-full bg-muted" />
        <div className="mt-2 h-4 w-3/4 max-w-lg animate-pulse rounded-full bg-muted" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />
            <div className="mt-3 h-6 w-36 animate-pulse rounded-md bg-muted" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
