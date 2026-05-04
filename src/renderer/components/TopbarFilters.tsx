import { useEffect } from "react";
import { MonthYearSelector } from "./MonthYearSelector";
import { useAppStore } from "../stores/app-store";
import { cn } from "../lib/utils";

export function TopbarFilters() {
  const {
    profiles,
    businessUnits,
    profileId,
    businessUnitId,
    month,
    year,
    closingStatus,
    setBusinessUnits,
    setBusinessUnitId,
    setClosingStatus,
    setPeriod,
    setProfileId,
  } = useAppStore();

  useEffect(() => {
    if (!profileId || !businessUnitId) {
      return;
    }

    void window.metrion
      .getClosingStatus({ profileId, businessUnitId, month, year })
      .then(setClosingStatus);
  }, [businessUnitId, month, profileId, setClosingStatus, year]);

  async function handleProfileChange(nextProfileId: number) {
    setProfileId(nextProfileId);
    const nextUnits = await window.metrion.listBusinessUnits(nextProfileId);
    setBusinessUnits(nextUnits);
    setBusinessUnitId(nextUnits[0]?.id ?? null);
  }

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
      <select
        className="h-9 max-w-40 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
        value={profileId ?? ""}
        onChange={(event) => handleProfileChange(Number(event.target.value))}
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
      <select
        className="h-9 max-w-72 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
        value={businessUnitId ?? ""}
        onChange={(event) => setBusinessUnitId(Number(event.target.value))}
      >
        {businessUnits.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name}
          </option>
        ))}
      </select>
      <MonthYearSelector month={month} year={year} onChange={setPeriod} />
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-semibold",
          closingStatus === "closed"
            ? "bg-red-100 text-red-700"
            : "bg-emerald-100 text-emerald-700",
        )}
      >
        {closingStatus === "closed" ? "cerrado" : "abierto"}
      </span>
    </div>
  );
}

