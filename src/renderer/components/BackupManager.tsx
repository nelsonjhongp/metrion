import { ArchiveRestore, DatabaseBackup, FileJson2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  BackupSelectionProfile,
  ImportBackupApplyResult,
  ImportBackupPreview,
} from "../../shared/types";
import { Alert } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

type BackupManagerProps = {
  active: boolean;
};

export function BackupManager({ active }: BackupManagerProps) {
  const [exportProfiles, setExportProfiles] = useState<BackupSelectionProfile[]>([]);
  const [isLoadingExportTree, setIsLoadingExportTree] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportBackupPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportBackupApplyResult | null>(null);
  const [isLoadingImport, setIsLoadingImport] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;

    setIsLoadingExportTree(true);
    setError(null);

    void window.metrion
      .exportBackupPreview()
      .then((preview) => {
        setExportProfiles(preview.profiles);
      })
      .catch(() => {
        setError("No se pudo preparar el árbol de respaldo.");
      })
      .finally(() => setIsLoadingExportTree(false));
  }, [active]);

  const selectionStats = useMemo(() => {
    const selectedProfiles = exportProfiles.filter((profile) =>
      profile.units.some((unit) => unit.selected),
    );
    const selectedUnits = selectedProfiles.reduce(
      (sum, profile) => sum + profile.units.filter((unit) => unit.selected).length,
      0,
    );

    return { selectedProfiles: selectedProfiles.length, selectedUnits };
  }, [exportProfiles]);

  function toggleProfile(profileId: number, checked: boolean) {
    setExportProfiles((current) =>
      current.map((profile) =>
        profile.profileId === profileId
          ? {
              ...profile,
              selected: checked,
              units: profile.units.map((unit) => ({ ...unit, selected: checked })),
            }
          : profile,
      ),
    );
  }

  function toggleUnit(profileId: number, businessUnitId: number, checked: boolean) {
    setExportProfiles((current) =>
      current.map((profile) => {
        if (profile.profileId !== profileId) return profile;

        const units = profile.units.map((unit) =>
          unit.businessUnitId === businessUnitId ? { ...unit, selected: checked } : unit,
        );

        return {
          ...profile,
          selected: units.some((unit) => unit.selected),
          units,
        };
      }),
    );
  }

  async function handleExportBackup() {
    setIsExporting(true);
    setExportMessage(null);
    setError(null);

    try {
      const result = await window.metrion.exportBackupFile({
        profiles: exportProfiles
          .map((profile) => ({
            profileId: profile.profileId,
            businessUnitIds: profile.units
              .filter((unit) => unit.selected)
              .map((unit) => unit.businessUnitId),
          }))
          .filter((profile) => profile.businessUnitIds.length > 0),
      });

      if (result.success) {
        setExportMessage(
          `Respaldo exportado: ${result.exportedProfiles ?? 0} organizaciones y ${result.exportedUnits ?? 0} unidades.`,
        );
      } else if (result.error) {
        setError(result.error);
      }
    } catch {
      setError("No se pudo exportar el respaldo.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportPreview() {
    setIsLoadingImport(true);
    setImportResult(null);
    setError(null);

    try {
      const preview = await window.metrion.importBackupPreview();
      if (!preview.sessionId) {
        setImportPreview(null);
        setError(preview.warnings[0] ?? "No se pudo preparar la restauración.");
        return;
      }
      setImportPreview(preview);
    } catch {
      setError("No se pudo leer el respaldo.");
    } finally {
      setIsLoadingImport(false);
    }
  }

  async function handleApplyImport() {
    if (!importPreview) return;

    setIsApplyingImport(true);
    setError(null);

    try {
      const result = await window.metrion.importBackupApply({
        sessionId: importPreview.sessionId,
      });
      setImportResult(result);
      if (!result.success && result.errors.length > 0) {
        setError(result.errors[0] ?? "No se pudo restaurar el respaldo.");
      }
    } catch {
      setError("No se pudo restaurar el respaldo.");
    } finally {
      setIsApplyingImport(false);
    }
  }

  return (
    <div className="space-y-3">
      {(error || exportMessage) && (
        <Alert
          aria-live="polite"
          className="rounded-xl"
          variant={error ? "danger" : "success"}
        >
          {error ?? exportMessage}
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-success bg-success/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <DatabaseBackup className="h-4 w-4 text-success-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Exportar</h3>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{selectionStats.selectedProfiles} organizaciones</Badge>
              <Badge variant="secondary">{selectionStats.selectedUnits} unidades</Badge>
            </div>

            {isLoadingExportTree ? (
              <p className="text-sm text-muted-foreground">Preparando…</p>
            ) : exportProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay datos para exportar.
              </p>
            ) : (
              <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
                {exportProfiles.map((profile) => (
                  <div
                    className="rounded-xl border border-border bg-card p-3"
                    key={profile.profileId}
                  >
                    <label className="flex items-center gap-3 text-sm font-medium text-foreground">
                      <input
                        checked={profile.units.every((unit) => unit.selected)}
                        className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        onChange={(event) => toggleProfile(profile.profileId, event.target.checked)}
                        type="checkbox"
                      />
                      <span>{profile.name}</span>
                    </label>
                    <div className="mt-2 grid gap-2 pl-7">
                      {profile.units.map((unit) => (
                        <label
                          className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm"
                          key={unit.businessUnitId}
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <input
                              checked={unit.selected}
                              className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                              onChange={(event) =>
                                toggleUnit(profile.profileId, unit.businessUnitId, event.target.checked)
                              }
                              type="checkbox"
                            />
                            <span className="truncate">{unit.name}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                disabled={isExporting || selectionStats.selectedUnits === 0}
                onClick={() => void handleExportBackup()}
              >
                <FileJson2 className="mr-1.5 h-4 w-4" />
                {isExporting ? "Exportando respaldo…" : "Guardar respaldo"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border bg-surface px-4 py-3">
            <div className="flex items-center gap-2">
              <ArchiveRestore className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Restaurar</h3>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex justify-start">
              <Button
                disabled={isLoadingImport}
                onClick={() => void handleImportPreview()}
                variant="secondary"
              >
                {isLoadingImport ? "Leyendo respaldo…" : "Seleccionar respaldo"}
              </Button>
            </div>

            {importPreview ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-sm font-medium">{importPreview.fileName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Versión {importPreview.version}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ImpactBox label="Perfiles nuevos" value={importPreview.totals.profilesCreate} />
                  <ImpactBox label="Unidades nuevas" value={importPreview.totals.unitsCreate} />
                  <ImpactBox label="Compras nuevas" value={importPreview.totals.purchasesNew} />
                  <ImpactBox label="Compras repetidas" value={importPreview.totals.purchasesExisting} />
                  <ImpactBox label="Ventas nuevas" value={importPreview.totals.salesNew} />
                  <ImpactBox label="Ventas a actualizar" value={importPreview.totals.salesUpdates} />
                </div>

                <div className="max-h-[220px] space-y-2 overflow-auto pr-1">
                  {importPreview.profiles.map((profile) => (
                    <div className="rounded-xl border border-border p-3" key={profile.profileName}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{profile.profileName}</p>
                        <Badge variant={profile.willCreateProfile ? "warning" : "secondary"}>
                          {profile.willCreateProfile ? "Se creará" : "Ya existe"}
                        </Badge>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {profile.units.map((unit) => (
                          <div
                            className="rounded-lg bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
                            key={`${profile.profileName}-${unit.unitName}`}
                          >
                            <p className="font-medium text-foreground">{unit.unitName}</p>
                            <p className="mt-1">
                              {unit.suppliers} proveedores · {unit.purchasesNew} compras nuevas ·{" "}
                              {unit.purchasesExisting} repetidas
                            </p>
                            <p>
                              {unit.salesNew} ventas nuevas · {unit.salesUpdates} ventas a actualizar
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {importPreview.warnings.length > 0 && (
                  <Alert className="rounded-xl px-3 py-2 text-xs" variant="warning">
                    {importPreview.warnings.join(" ")}
                  </Alert>
                )}

                <div className="flex justify-end">
                  <Button
                    disabled={isApplyingImport}
                    onClick={() => void handleApplyImport()}
                  >
                    {isApplyingImport ? "Restaurando…" : "Aplicar restauración"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecciona un archivo para ver la vista previa.
              </p>
            )}

            {importResult && (
              <Alert
                aria-live="polite"
                className="rounded-xl px-3 py-3 text-sm"
                variant={importResult.success ? "success" : "danger"}
              >
                <p className="font-medium">
                  {importResult.success ? "Restauración completada" : "Restauración con errores"}
                </p>
                <p className="mt-1 text-xs">
                  {importResult.created.profiles} perfiles, {importResult.created.units} unidades,{" "}
                  {importResult.created.suppliers} proveedores, {importResult.created.purchases} compras,
                  {" "}{importResult.created.sales} ventas y {importResult.created.closings} cierres creados.
                </p>
                <p className="mt-1 text-xs">
                  {importResult.updated.sales} ventas y {importResult.updated.closings} cierres actualizados.
                </p>
              </Alert>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ImpactBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
