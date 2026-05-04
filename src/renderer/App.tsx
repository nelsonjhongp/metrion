import { useEffect, useState } from "react";
import { AppLayout, type AppPage } from "./components/AppLayout";
import { EmptyState } from "./components/EmptyState";
import { ClosingPage } from "./pages/ClosingPage";
import { HistoryPage } from "./pages/HistoryPage";
import { MonthlyControlPage } from "./pages/MonthlyControlPage";
import { PurchasesPage } from "./pages/PurchasesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SalesPage } from "./pages/SalesPage";
import { SummaryPage } from "./pages/SummaryPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { useAppStore } from "./stores/app-store";

export function App() {
  const [activePage, setActivePage] = useState<AppPage>("control");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setContext = useAppStore((state) => state.setContext);

  useEffect(() => {
    if (!window.metrion) {
      setError("No se pudo cargar el puente local de Electron.");
      setIsLoading(false);
      return;
    }

    void window.metrion
      .getContext()
      .then(setContext)
      .catch(() => {
        setError("No se pudo cargar la base local.");
      })
      .finally(() => setIsLoading(false));
  }, [setContext]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Cargando Metrion...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <EmptyState title={error} />
      </div>
    );
  }

  return (
    <AppLayout activePage={activePage} onNavigate={setActivePage}>
      {activePage === "control" && <MonthlyControlPage />}
      {activePage === "purchases" && <PurchasesPage />}
      {activePage === "suppliers" && <SuppliersPage />}
      {activePage === "history" && <HistoryPage />}
      {activePage === "reports" && <ReportsPage />}
      {activePage === "sales" && <SalesPage />}
      {activePage === "summary" && <SummaryPage />}
      {activePage === "closing" && <ClosingPage />}
    </AppLayout>
  );
}
