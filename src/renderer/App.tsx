import { useEffect, useState } from "react";
import { AppLayout, type AppPage } from "./components/AppLayout";
import { EmptyState } from "./components/EmptyState";
import { DataPage } from "./pages/DataPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ManagePage } from "./pages/ManagePage";
import { MonthlyControlPage } from "./pages/MonthlyControlPage";
import { PurchasesPage } from "./pages/PurchasesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SplashPage } from "./pages/SplashPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { useAppStore } from "./stores/app-store";

export function App() {
  const [activePage, setActivePage] = useState<AppPage>("control");
  const [lastWorkPage, setLastWorkPage] = useState<AppPage>("control");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setContext = useAppStore((state) => state.setContext);
  const profileId = useAppStore((state) => state.profileId);
  const purchaseSupplierFlow = useAppStore((state) => state.purchaseSupplierFlow);

  const isSplash = window.location.hash === "#splash";

  useEffect(() => {
    if (!window.metrion) {
      setError("No se pudo cargar el puente local de Electron.");
      setIsLoading(false);
      return;
    }

    void window.metrion
      .getContext()
      .then(async (ctx) => {
        setContext(ctx);
        if (!isSplash) {
          // Main window: load units for the current profile
          const pid = ctx.selectedProfileId;
          if (pid) {
            const units = await window.metrion.listBusinessUnits(pid);
            useAppStore.getState().setBusinessUnits(units);
            useAppStore.getState().setBusinessUnitId(units[0]?.id ?? null);
          }
        }
      })
      .catch(() => {
        setError("No se pudo cargar la base local.");
      })
      .finally(() => setIsLoading(false));
  }, [isSplash, setContext]);

  const handleEnter = async (profileId: number) => {
    await window.metrion.enterApp(profileId);
  };

  const handleLogout = async () => {
    await window.metrion.logoutApp();
  };

  const handleOpenDataCenter = () => {
    setLastWorkPage(activePage === "data" ? lastWorkPage : activePage);
    setActivePage("data");
  };

  const handleNavigate = (page: AppPage) => {
    if (page !== "data") {
      setLastWorkPage(page);
    }
    setActivePage(page);
  };

  const handleOpenSupplierCatalogFromPurchase = () => {
    setLastWorkPage(activePage === "data" ? lastWorkPage : activePage);
    setActivePage("suppliers");
  };

  const handleReturnToPurchaseFlow = () => {
    if (purchaseSupplierFlow) {
      setActivePage(purchaseSupplierFlow.returnPage);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Cargando Metrion…</p>
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

  if (isSplash || !profileId) {
    return <SplashPage onEnter={handleEnter} />;
  }

  return (
    <>
      <AppLayout
        activePage={activePage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      >
        {activePage === "control" && (
          <MonthlyControlPage onOpenSupplierCatalogFromPurchase={handleOpenSupplierCatalogFromPurchase} />
        )}
        {activePage === "dashboard" && <DashboardPage />}
        {activePage === "purchases" && (
          <PurchasesPage onOpenSupplierCatalogFromPurchase={handleOpenSupplierCatalogFromPurchase} />
        )}
        {activePage === "suppliers" && (
          <SuppliersPage onReturnToPurchaseFlow={handleReturnToPurchaseFlow} />
        )}
        {activePage === "history" && <HistoryPage />}
        {activePage === "reports" && <ReportsPage />}
        {activePage === "manage" && <ManagePage onOpenBackups={handleOpenDataCenter} />}
        {activePage === "data" && <DataPage onBack={() => setActivePage(lastWorkPage)} />}
      </AppLayout>
    </>
  );
}
