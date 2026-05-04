import {
  ClipboardList,
  FileCheck2,
  ReceiptText,
  Store,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { TopbarFilters } from "./TopbarFilters";
import { cn } from "../lib/utils";

export type AppPage = "purchases" | "sales" | "summary" | "closing" | "suppliers";

const navItems = [
  { id: "purchases", label: "Compras", icon: ClipboardList },
  { id: "sales", label: "Ventas", icon: ReceiptText },
  { id: "summary", label: "Resumen", icon: FileCheck2 },
  { id: "closing", label: "Cierre", icon: Store },
  { id: "suppliers", label: "Proveedores", icon: UsersRound },
] satisfies Array<{
  id: AppPage;
  label: string;
  icon: typeof ClipboardList;
}>;

type AppLayoutProps = {
  activePage: AppPage;
  children: ReactNode;
  onNavigate: (page: AppPage) => void;
};

export function AppLayout({ activePage, children, onNavigate }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-slate-950 px-3 py-4 text-white">
        <div className="mb-6 px-2">
          <p className="text-lg font-semibold tracking-tight">Metrion</p>
          <p className="text-xs text-slate-400">control mensual</p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                  isActive
                    ? "bg-white text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white",
                )}
                key={item.id}
                onClick={() => onNavigate(item.id)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-4 border-b border-border bg-surface px-5">
          <div>
            <p className="text-sm font-semibold">Periodo de trabajo</p>
            <p className="text-xs text-muted-foreground">perfil, unidad y mes</p>
          </div>
          <TopbarFilters />
        </header>
        <main className="flex-1 overflow-hidden p-5">{children}</main>
      </div>
    </div>
  );
}

