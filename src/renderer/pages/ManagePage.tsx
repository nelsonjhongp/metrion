import {
  Building2,
  Check,
  ChevronRight,
  DatabaseBackup,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { TablePaginationControls } from "../components/TablePaginationControls";
import { Alert } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { useAppStore } from "../stores/app-store";

const PAGE_SIZE = 5;

type ManagePageProps = {
  onOpenBackups: () => void;
};

export function ManagePage({ onOpenBackups }: ManagePageProps) {
  const {
    profiles,
    profileId,
    businessUnits,
    updateProfile,
    addBusinessUnit,
    updateBusinessUnit,
    deactivateBusinessUnit,
    removeProfile,
    setBusinessUnits,
    setProfileId,
    setBusinessUnitId,
  } = useAppStore();

  const currentProfile = profiles.find((profile) => profile.id === profileId) ?? null;
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [newUnit, setNewUnit] = useState("");
  const [unitError, setUnitError] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [editUnitName, setEditUnitName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!currentProfile) return;
    setName(currentProfile.name);
    setNameError(null);
    setNameSaved(false);
    setNewUnit("");
    setUnitError(null);
    setEditingUnitId(null);
    setDeleteOpen(false);
    setDeleteConfirm("");
    setDeleteError(null);
    setPage(1);
  }, [currentProfile]);

  const totalPages = Math.max(1, Math.ceil(businessUnits.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedUnits = useMemo(
    () => businessUnits.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [businessUnits, currentPage],
  );

  async function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed || !profileId) return;

    setNameError(null);
    setNameSaved(false);

    try {
      await window.metrion.updateProfile({ id: profileId, name: trimmed });
      updateProfile(profileId, trimmed);
      setNameSaved(true);
    } catch (error) {
      setNameError(error instanceof Error ? error.message : "No se pudo guardar.");
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
      setPage(Math.max(1, Math.ceil((businessUnits.length + 1) / PAGE_SIZE)));
    } catch (error) {
      setUnitError(error instanceof Error ? error.message : "No se pudo crear la unidad.");
    }
  }

  async function handleEditUnit(id: number) {
    const trimmed = editUnitName.trim();
    if (!trimmed) return;

    setUnitError(null);

    try {
      await window.metrion.updateBusinessUnit({ id, name: trimmed });
      updateBusinessUnit(id, trimmed);
      setEditingUnitId(null);
      setEditUnitName("");
    } catch (error) {
      setUnitError(error instanceof Error ? error.message : "No se pudo editar la unidad.");
    }
  }

  async function handleDeactivateUnit(id: number) {
    try {
      await window.metrion.deactivateBusinessUnit(id);
      deactivateBusinessUnit(id);
    } catch (error) {
      setUnitError(error instanceof Error ? error.message : "No se pudo desactivar la unidad.");
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
        setBusinessUnitId(units[0]?.id ?? null);
      } else {
        setProfileId(null);
        setBusinessUnits([]);
        setBusinessUnitId(null);
      }

      setDeleteOpen(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar la organización.");
    }
  }

  if (!currentProfile) {
    return (
      <section className="max-w-3xl">
        <PageHeader
          description="Selecciona una organización para administrar sus datos generales."
          title="Gestionar"
        />
      </section>
    );
  }

  return (
    <section className="max-w-[1080px] space-y-4">
      <PageHeader
        description="Administra la información general de la organización y sus unidades de negocio."
        title={`Gestionar ${currentProfile.name}`}
      />

      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="flex flex-col gap-5">
          <Card className="p-4">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-[1.05rem] font-semibold text-foreground">Información general</h2>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">Nombre de la organización</span>
                <Input
                  className="h-10 text-sm"
                  onChange={(event) => {
                    setName(event.target.value);
                    setNameSaved(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleSaveName();
                    }
                  }}
                  value={name}
                />
              </label>

              <Button className="h-9 rounded-lg" onClick={() => void handleSaveName()}>
                Guardar cambios
              </Button>

              {nameSaved ? (
                <div className="flex h-9 items-center justify-center gap-2 rounded-lg border border-success bg-success text-sm font-medium text-success-foreground">
                  <Check className="h-4 w-4" />
                  Guardado
                </div>
              ) : null}

              {nameError ? <Alert variant="danger">{nameError}</Alert> : null}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-col gap-4">
              <h2 className="text-[1.05rem] font-semibold text-foreground">Acciones</h2>

              <ActionCard
                description="Respalda o restaura datos de tu organización."
                icon={DatabaseBackup}
                onClick={onOpenBackups}
                title="Respaldo de la organización"
              />

              <Separator />

              <ActionCard
                danger
                description="Esta acción es permanente y no se puede deshacer."
                icon={Trash2}
                onClick={() => setDeleteOpen(true)}
                title="Eliminar organización"
              />
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[1.1rem] font-semibold tracking-tight text-foreground">Unidades de negocio</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gestiona las unidades de negocio que pertenecen a tu organización.
                </p>
              </div>
              <Button className="h-9 rounded-lg px-4" onClick={() => void handleAddUnit()}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva unidad
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card">
              <div className="grid grid-cols-[minmax(0,1fr)_152px] border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                <span>Unidades de negocio</span>
                <span className="text-right">Acciones</span>
              </div>

              <div>
                {pagedUnits.map((unit) => (
                  <div
                    className="grid grid-cols-[minmax(0,1fr)_152px] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
                    key={unit.id}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                        <Building2 className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        {editingUnitId === unit.id ? (
                          <div className="flex max-w-xl items-center gap-2">
                            <Input
                              autoFocus
                              className="h-11 flex-1"
                              onChange={(event) => setEditUnitName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  void handleEditUnit(unit.id);
                                }
                              }}
                              value={editUnitName}
                            />
                            <Button onClick={() => void handleEditUnit(unit.id)} size="sm">
                              Guardar
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium text-foreground">{unit.name}</p>
                              {!unit.isActive ? <Badge variant="secondary">Inactiva</Badge> : null}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">Unidad de negocio</p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      {editingUnitId === unit.id ? (
                        <Button onClick={() => setEditingUnitId(null)} size="sm" variant="secondary">
                          Cancelar
                        </Button>
                      ) : (
                        <>
                          <Button
                            aria-label={`Editar ${unit.name}`}
                            className="rounded-lg"
                            onClick={() => {
                              setEditingUnitId(unit.id);
                              setEditUnitName(unit.name);
                            }}
                            size="icon"
                            variant="secondary"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                aria-label={`Desactivar ${unit.name}`}
                                className="rounded-lg text-danger-foreground hover:bg-danger/70"
                                size="icon"
                                variant="secondary"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                              <DialogContent className="w-[400px]">
                                <DialogHeader>
                                  <DialogTitle>Desactivar unidad</DialogTitle>
                                  <DialogDescription>
                                    ¿Desactivar "{unit.name}"? Dejará de aparecer en los selectores, pero sus datos se conservan.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="pt-5">
                                  <DialogClose asChild>
                                    <Button variant="secondary">Cancelar</Button>
                                  </DialogClose>
                                  <DialogClose asChild>
                                    <Button onClick={() => void handleDeactivateUnit(unit.id)} variant="danger">
                                      Desactivar
                                    </Button>
                                  </DialogClose>
                                </DialogFooter>
                              </DialogContent>
                          </Dialog>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border px-5 py-4">
                <div className="mb-4 flex max-w-md items-center gap-2">
                  <Input
                    className="h-10 flex-1"
                    onChange={(event) => setNewUnit(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleAddUnit();
                      }
                    }}
                    placeholder="Nueva unidad de negocio…"
                    value={newUnit}
                  />
                  <Button className="h-10 rounded-lg px-4" onClick={() => void handleAddUnit()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar
                  </Button>
                </div>

                {unitError ? <Alert className="mb-3" variant="danger">{unitError}</Alert> : null}

                <TablePaginationControls
                  itemLabel="unidades"
                  onPageChange={setPage}
                  onPageSizeChange={() => undefined}
                  page={currentPage}
                  pageSize={PAGE_SIZE}
                  pageSizeOptions={[PAGE_SIZE]}
                  totalItems={businessUnits.length}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <DeleteProfileDialog
        confirmValue={deleteConfirm}
        error={deleteError}
        open={deleteOpen}
        profileName={currentProfile.name}
        onChangeConfirm={setDeleteConfirm}
        onConfirm={() => void handleDeleteProfile()}
        onOpenChange={setDeleteOpen}
      />
    </section>
  );
}

function ActionCard({
  description,
  icon: Icon,
  onClick,
  title,
  danger = false,
}: {
  title: string;
  description: string;
  icon: typeof DatabaseBackup;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className="flex w-full items-center justify-between gap-4 rounded-lg border border-transparent px-1 py-1 text-left transition-colors hover:bg-muted/40"
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center gap-4">
        <div className={danger ? "flex size-10 items-center justify-center rounded-lg bg-danger text-danger-foreground" : "flex size-10 items-center justify-center rounded-lg bg-accent text-primary"}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className={danger ? "text-sm font-medium text-danger-foreground" : "text-sm font-medium text-foreground"}>{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function DeleteProfileDialog({
  confirmValue,
  error,
  open,
  profileName,
  onChangeConfirm,
  onConfirm,
  onOpenChange,
}: {
  confirmValue: string;
  error: string | null;
  open: boolean;
  profileName: string;
  onChangeConfirm: (value: string) => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const matches = confirmValue.trim().toLowerCase() === profileName.trim().toLowerCase();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="w-[460px] border-danger">
        <DialogHeader>
          <DialogTitle className="text-lg">Eliminar organización</DialogTitle>
          <DialogDescription>
            Esta acción elimina la organización y su información asociada. Escribe <strong>{profileName}</strong> para confirmar.
          </DialogDescription>
        </DialogHeader>

          <div className="mt-5 space-y-3">
            <Input
              autoFocus
              className="h-12"
              onChange={(event) => onChangeConfirm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches) {
                  onConfirm();
                }
              }}
              placeholder={profileName}
              value={confirmValue}
            />
            {error ? <Alert variant="danger">{error}</Alert> : null}
          </div>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button disabled={!matches} onClick={onConfirm} variant="danger">
              Eliminar
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
