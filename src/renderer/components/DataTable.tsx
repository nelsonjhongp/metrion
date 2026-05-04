import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyText: string;
};

export function DataTable<T>({ columns, rows, emptyText }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyText} />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                className="h-9 px-3 text-left font-semibold"
                key={column.key}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr className="border-t border-border" key={rowIndex}>
              {columns.map((column) => (
                <td className={column.className ?? "px-3 py-2"} key={column.key}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

