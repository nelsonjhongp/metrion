import { ChevronDown } from "lucide-react";
import { useEffect } from "react";
import { MonthYearSelector } from "./MonthYearSelector";
import { Badge } from "./ui/badge";
import { useAppStore } from "../stores/app-store";

export function TopbarFilters() {
  const {
    businessUnits,
    businessUnitId,
    month,
    year,
    closingStatus,
    setBusinessUnitId,
    setClosingStatus,
    setPeriod,
  } = useAppStore();
  const profileId = useAppStore((state) => state.profileId);

  useEffect(() => {
    if (!profileId || !businessUnitId) return;
    void window.metrion
      .getClosingStatus({ profileId, businessUnitId, month, year })
      .then(setClosingStatus);
  }, [businessUnitId, month, profileId, setClosingStatus, year]);

  return (
    <div className="flex min-w-0 flex-1 items-center justify-start gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="relative min-w-[248px] max-w-[360px]">
          <select
            aria-label="Unidad de negocio"
            className="h-9 w-full appearance-none rounded-lg border border-border bg-card px-3.5 pr-9 text-[15px] font-medium tracking-tight text-foreground shadow-sm outline-none transition-colors hover:border-primary/30 focus-visible:border-primary/40"
            value={businessUnitId ?? ""}
            onChange={(event) => setBusinessUnitId(Number(event.target.value))}
          >
            {businessUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
        <MonthYearSelector month={month} year={year} onChange={setPeriod} />
      </div>
      <div className="flex items-center gap-1.5 pl-1 text-xs text-muted-foreground">
        <span>Estado :</span>
        <Badge variant={closingStatus === "closed" ? "danger" : "success"} className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium">
        {closingStatus === "closed" ? "cerrado" : "abierto"}
        </Badge>
      </div>
    </div>
  );
}
