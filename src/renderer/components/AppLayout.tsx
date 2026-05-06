import {
  BookOpen,
  CalendarCheck,
  ChartBar,
  ClipboardList,
  LogOut,
  Settings,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import logoIcon from "../assets/metrion-logo-icon.svg";
import { TopbarFilters } from "./TopbarFilters";
import { cn } from "../lib/utils";
import { useAppStore } from "../stores/app-store";

export type AppPage =
  | "control"
  | "dashboard"
  | "purchases"
  | "suppliers"
  | "history"
  | "reports"
  | "manage"
  | "data";

type NavItem = {
  id: AppPage;
  label: string;
  icon: typeof CalendarCheck;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { id: "control", label: "Control del mes", icon: CalendarCheck },
  { id: "dashboard", label: "Dashboard", icon: ChartBar },
  { id: "purchases", label: "Compras", icon: ClipboardList },
  { id: "suppliers", label: "Proveedores", icon: UsersRound },
  { id: "history", label: "Historial", icon: BookOpen },
  { id: "reports", label: "Excel", icon: ChartBar },
];

type AppLayoutProps = {
  activePage: AppPage;
  children: ReactNode;
  onNavigate: (page: AppPage) => void;
  onLogout: () => void;
};

export function AppLayout({
  activePage,
  children,
  onNavigate,
  onLogout,
}: AppLayoutProps) {
  const profileName = useAppStore(
    (s) => s.profiles.find((p) => p.id === s.profileId)?.name ?? "",
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground">
        <div className="mb-6 px-2">
          <div className="flex items-center gap-2.5">
            <img alt="Metrion" className="size-7 shrink-0" src={logoIcon} />
            <div className="min-w-0">
              <p className="text-base font-semibold tracking-tight truncate">Metrion</p>
              <p className="truncate text-[11px] text-sidebar-foreground/65">
                {profileName || "control mensual"}
              </p>
            </div>
          </div>
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
                    ? "bg-sidebar-active text-sidebar-active-foreground"
                    : !item.disabled
                      ? "text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                      : "text-sidebar-foreground/45",
                )}
                disabled={item.disabled}
                key={item.id}
                onClick={() => onNavigate(item.id)}
                title={item.disabled ? "Próximamente" : undefined}
                type="button"
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {item.label}
                {item.disabled && (
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-sidebar-foreground/35">
                    pronto
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-sidebar-border pt-3">
          <button
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors",
              activePage === "manage"
                ? "bg-sidebar-active text-sidebar-active-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
            )}
            onClick={() => onNavigate("manage")}
            type="button"
          >
            <Settings aria-hidden="true" className="h-4 w-4" />
            Gestionar
          </button>
          <button
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
            onClick={onLogout}
            type="button"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Salir
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[54px] shrink-0 items-center border-b border-border bg-surface px-5">
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
