import { Building2, DatabaseBackup, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { BusinessUnit } from "../../shared/types";
import { Alert } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { useAppStore } from "../stores/app-store";

type ProfileDialogProps = {
  onOpenBackups: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProfileDialog({ onOpenBackups, open, onOpenChange }: ProfileDialogProps) {
  const {
    profiles,
    profileId,
    businessUnits,
    updateProfile,
    addBusinessUnit,
    updateBusinessUnit,
    removeBusinessUnit,
    deactivateBusinessUnit,
    removeProfile,
    setBusinessUnits,
    setProfileId,
  } = useAppStore();

  const currentProfile = profiles.find((p) => p.id === profileId);

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [newUnit, setNewUnit] = useState("");
  const [unitError, setUnitError] = useState<string | null>(null);

  // Unit editing
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [editUnitName, setEditUnitName] = useState("");

  // Delete confirmation
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (open && currentProfile) {
      setName(currentProfile.name);
      setNameError(null);
      setNewUnit("");
      setUnitError(null);
      setEditingUnitId(null);
      setShowDelete(false);
      setDeleteConfirm("");
      setDeleteError(null);
    }
  }, [open, currentProfile]);

  async function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed || !profileId) return;
    setNameError(null);
    try {
      await window.metrion.updateProfile({ id: profileId, name: trimmed });
      updateProfile(profileId, trimmed);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Error al guardar.");
    }
  }

  async function handleAddUnit() {
    const trimmed = newUnit.trim();
    if (!trimmed || !profileId) return;
    setUnitError(null);
    try {
      const unit = await window.metrion.createBusinessUnit({ profileId, name: trimmed });
      addBusinessUnit(unit);
      setNewUnit("");
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : "Error al crear.");
    }
  }

  async function handleEditUnit(id: number) {
    const trimmed = editUnitName.trim();
    if (!trimmed) return;
    try {
      await window.metrion.updateBusinessUnit({ id, name: trimmed });
      updateBusinessUnit(id, trimmed);
      setEditingUnitId(null);
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : "Error al editar.");
    }
  }

  async function handleDeactivateUnit(id: number) {
    try {
      await window.metrion.deactivateBusinessUnit(id);
      deactivateBusinessUnit(id);
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : "Error al desactivar.");
    }
  }

  async function handleDeleteProfile() {
    if (!profileId || !currentProfile) return;
    if (deleteConfirm.trim().toLowerCase() !== currentProfile.name.trim().toLowerCase()) return;
    setDeleteError(null);
    try {
      await window.metrion.deleteProfile(profileId);
      removeProfile(profileId);
      const remaining = useAppStore.getState().profiles;
      if (remaining.length > 0) {
        const nextId = remaining[0].id;
        setProfileId(nextId);
        const units = await window.metrion.listBusinessUnits(nextId);
        setBusinessUnits(units);
        useAppStore.getState().setBusinessUnitId(units[0]?.id ?? null);
      } else {
        setProfileId(null);
      }
      onOpenChange(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error al eliminar.");
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="w-[min(640px,92vw)] max-h-[88vh]">
        <DialogHeader>
          <DialogTitle>Gestionar {currentProfile?.name ?? ""}</DialogTitle>
        </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleSaveName(); }}
                    placeholder="Nombre…"
                    value={name}
                  />
                  <Button onClick={() => void handleSaveName()} size="sm">
                    Guardar
                  </Button>
                </div>
                {nameError && <Alert className="text-xs" variant="danger">{nameError}</Alert>}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <p className="text-sm font-medium">Unidades de negocio</p>
                {businessUnits.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin unidades</p>
                ) : (
                  <div className="space-y-1">
                    {businessUnits.map((unit: BusinessUnit) => (
                      <div
                        className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
                        key={unit.id}
                      >
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {editingUnitId === unit.id ? (
                          <Input
                            autoFocus
                            className="h-7 flex-1 text-sm"
                            defaultValue={unit.name}
                            onChange={(e) => setEditUnitName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") void handleEditUnit(unit.id); }}
                          />
                        ) : (
                          <span className="flex-1 truncate">{unit.name}</span>
                        )}
                        {!unit.isActive && (
                          <Badge variant="secondary">Inactiva</Badge>
                        )}
                        {editingUnitId === unit.id ? (
                          <>
                            <Button
                              onClick={() => void handleEditUnit(unit.id)}
                              size="sm"
                              variant="ghost"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              onClick={() => setEditingUnitId(null)}
                              size="sm"
                              variant="ghost"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              aria-label={`Editar ${unit.name}`}
                              onClick={() => { setEditingUnitId(unit.id); setEditUnitName(unit.name); }}
                              size="sm"
                              variant="ghost"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <ConfirmDialog
                              confirmLabel="Desactivar"
                              description={`¿Desactivar "${unit.name}"? Dejará de aparecer en los selectores pero sus datos se conservan.`}
                              onConfirm={() => void handleDeactivateUnit(unit.id)}
                              title="Desactivar unidad"
                            >
                              <Button
                                aria-label={`Eliminar ${unit.name}`}
                                size="sm"
                                variant="ghost"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </ConfirmDialog>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    onChange={(e) => setNewUnit(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleAddUnit(); }}
                    placeholder="Nueva unidad…"
                    value={newUnit}
                  />
                  <Button onClick={() => void handleAddUnit()} size="sm" variant="secondary">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {unitError && <Alert className="text-xs" variant="danger">{unitError}</Alert>}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <DatabaseBackup className="h-4 w-4 text-muted-foreground" />
                Respaldo
              </div>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  onOpenBackups();
                }}
                size="sm"
                variant="secondary"
              >
                Abrir
              </Button>
            </div>

            {showDelete ? (
              <div className="space-y-3 rounded-md border border-danger bg-danger p-3">
                <p className="text-sm font-medium text-danger-foreground">
                  Eliminar {currentProfile?.name ?? ""}
                </p>
                <p className="text-xs text-danger-foreground">
                  Escribe <strong>{currentProfile?.name ?? ""}</strong> para confirmar:
                </p>
                <Input
                  autoFocus
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleDeleteProfile(); }}
                  placeholder={currentProfile?.name ?? ""}
                  value={deleteConfirm}
                />
                {deleteError && <Alert className="text-xs" variant="danger">{deleteError}</Alert>}
                <div className="flex justify-end gap-2">
                  <Button onClick={() => { setShowDelete(false); setDeleteConfirm(""); }} size="sm" variant="ghost">
                    Cancelar
                  </Button>
                  <Button
                    disabled={deleteConfirm.trim().toLowerCase() !== (currentProfile?.name ?? "").trim().toLowerCase()}
                    onClick={() => void handleDeleteProfile()}
                    size="sm"
                    variant="danger"
                  >
                    Confirmar eliminación
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger bg-danger/50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-danger-foreground">Eliminar organización</p>
                </div>
                <Button onClick={() => setShowDelete(true)} size="sm" variant="danger">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Eliminar
                </Button>
              </div>
            )}
          </div>

        <div className="mt-5 flex items-center justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
