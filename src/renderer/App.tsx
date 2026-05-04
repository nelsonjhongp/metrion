import { useEffect, useState } from "react";
import { AppLayout, type AppPage } from "./components/AppLayout";
import { EmptyState } from "./components/EmptyState";
import { ClosingPage } from "./pages/ClosingPage";
import { PurchasesPage } from "./pages/PurchasesPage";
import { SalesPage } from "./pages/SalesPage";
import { SummaryPage } from "./pages/SummaryPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { useAppStore } from "./stores/app-store";

export function App() {
  const [activePage, setActivePage] = useState<AppPage>("purchases");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setContext = useAppStore((state) => state.setContext);

  useEffect(() => {
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
      {activePage === "purchases" && <PurchasesPage />}
      {activePage === "sales" && <SalesPage />}
      {activePage === "summary" && <SummaryPage />}
      {activePage === "closing" && <ClosingPage />}
      {activePage === "suppliers" && <SuppliersPage />}
    </AppLayout>
  );
}

