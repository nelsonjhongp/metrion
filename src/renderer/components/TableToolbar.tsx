import type { ReactNode } from "react";
import { cn } from "../lib/utils";

type TableToolbarProps = {
  children: ReactNode;
  className?: string;
};

export function TableToolbar({ children, className }: TableToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border bg-surface px-4 py-3 sm:flex-row sm:flex-wrap sm:items-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

type TableToolbarFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function TableToolbarField({
  label,
  children,
  className,
}: TableToolbarFieldProps) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
