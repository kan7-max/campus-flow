import type { ReactNode } from "react";

type EmptyStateProps = {
  actions?: ReactNode;
  description: string;
  title: string;
};

export function EmptyState({ actions, description, title }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center sm:p-8">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      {actions ? <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
