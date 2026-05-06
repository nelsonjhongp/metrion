import { ArrowLeft } from "lucide-react";
import { BackupManager } from "../components/BackupManager";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";

type DataPageProps = {
  onBack: () => void;
};

export function DataPage({ onBack }: DataPageProps) {
  return (
    <section className="space-y-4">
      <PageHeader
        actions={(
          <Button onClick={onBack} variant="secondary">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver
          </Button>
        )}
        description="Respaldos y restauración"
        title="Respaldo"
      />

      <BackupManager active />
    </section>
  );
}
