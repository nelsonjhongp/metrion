import {
  BookOpen,
  CalendarCheck,
  ChartBar,
  ClipboardList,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { TopbarFilters } from "./TopbarFilters";
import { cn } from "../lib/utils";

export type AppPage =
  | "control"
  | "purchases"
  | "suppliers"
  | "history"
  | "reports"
  | "sales"
  | "summary"
  | "closing";

type NavItem = {
  id: AppPage;
  label: string;
  icon: typeof CalendarCheck;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { id: "control", label: "Control del mes", icon: CalendarCheck },
  { id: "purchases", label: "Compras", icon: ClipboardList },
  { id: "suppliers", label: "Proveedores", icon: UsersRound },
  { id: "history", label: "Historial", icon: BookOpen, disabled: true },
  { id: "reports", label: "Reportes", icon: ChartBar, disabled: true },
];

type AppLayoutProps = {
  activePage: AppPage;
  children: ReactNode;
  onNavigate: (page: AppPage) => void;
};

export function AppLayout({ activePage, children, onNavigate }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[#0F1525] bg-[#060B1A] px-3 py-4 text-white">
        <div className="mb-6 px-2">
          <p className="text-lg font-semibold tracking-tight">Metrion</p>
          <p className="text-xs text-slate-400">control mensual</p>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                  item.disabled && "cursor-not-allowed opacity-40",
                  isActive && !item.disabled
                    ? "bg-white text-slate-950"
                    : !item.disabled
                      ? "text-slate-300 hover:bg-white/10 hover:text-white"
                      : "text-slate-500",
                )}
                disabled={item.disabled}
                key={item.id}
                onClick={() => onNavigate(item.id)}
                title={item.disabled ? "Proximamente" : undefined}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.disabled && (
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-600">
                    pronto
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-6">
          <div>
            <p className="text-sm font-semibold">Periodo de trabajo</p>
            <p className="text-xs text-muted-foreground">perfil, unidad y mes</p>
          </div>
          <TopbarFilters />
        </header>
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-[1280px] px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

