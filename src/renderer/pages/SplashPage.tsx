import { Building2, Plus } from "lucide-react";
import { useState } from "react";
import logoIcon from "../assets/metrion-logo-icon.svg";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAppStore } from "../stores/app-store";

type SplashPageProps = {
  onEnter: (profileId: number) => void;
};

export function SplashPage({ onEnter }: SplashPageProps) {
  const { profiles, addProfile, setProfileId } = useAppStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSelectProfile(id: number) {
    setProfileId(id);
    onEnter(id);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) { setError("Ingresa un nombre."); return; }
    setError(null);
    try {
      const profile = await window.metrion.createProfile({ name });
      addProfile(profile);
      setNewName("");
      setIsCreating(false);
      handleSelectProfile(profile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-8">
      <div className="w-full max-w-xs space-y-6">
        <div className="flex flex-col items-center gap-2">
          <img alt="Metrion" className="size-12" src={logoIcon} />
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Metrion
            </h1>
            <p className="text-xs text-muted-foreground">
              Control mensual de compras y ventas
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Organizaciones
          </p>

          {profiles.map((profile) => (
            <Card
              className="flex items-center gap-3 p-3 cursor-pointer hover:border-primary/50 transition-colors"
              key={profile.id}
              onClick={() => handleSelectProfile(profile.id)}
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {profile.name}
                </p>
                <p className="text-xs text-muted-foreground">Ingresar</p>
              </div>
            </Card>
          ))}

          {isCreating ? (
            <Card className="p-3 space-y-2.5">
              <input
                autoFocus
                className="field"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
                placeholder="Nombre de la organización…"
                value={newName}
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void handleCreate()} size="sm">
                  Crear
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => { setIsCreating(false); setNewName(""); setError(null); }}
                  size="sm"
                  variant="ghost"
                >
                  Cancelar
                </Button>
              </div>
            </Card>
          ) : (
            <button
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              onClick={() => setIsCreating(true)}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Nueva organización
            </button>
          )}
        </div>

        {profiles.length > 0 && (
          <div className="flex items-center gap-2 justify-center">
            <Badge variant="secondary">
              {profiles.length} {profiles.length === 1 ? "organización" : "organizaciones"}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
