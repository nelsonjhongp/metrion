import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  action?: ReactNode;
};

export function EmptyState({ title, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-card/70 text-center">
      <p className="text-sm text-muted-foreground">{title}</p>
      {action}
    </div>
  );
}
