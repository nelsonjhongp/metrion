import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useCallback, useMemo } from "react";

const months = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;
  return {
    value: month,
    label: format(new Date(2026, index, 1), "LLLL", { locale: es }),
  };
});

function buildYears(): number[] {
  const current = new Date().getFullYear();
  const result: number[] = [];
  for (let y = current - 3; y <= current + 3; y++) {
    result.push(y);
  }
  return result;
}

type MonthYearSelectorProps = {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
};

export function MonthYearSelector({
  month,
  year,
  onChange,
}: MonthYearSelectorProps) {
  const years = useMemo(() => buildYears(), []);

  const goPrev = useCallback(() => {
    if (month === 1) {
      onChange(12, year - 1);
    } else {
      onChange(month - 1, year);
    }
  }, [month, year, onChange]);

  const goNext = useCallback(() => {
    if (month === 12) {
      onChange(1, year + 1);
    } else {
      onChange(month + 1, year);
    }
  }, [month, year, onChange]);

  return (
    <div className="flex items-center gap-1">
      <button
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        onClick={goPrev}
        title="Mes anterior"
        type="button"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <select
        className="h-9 rounded-md border border-border bg-white px-3 text-sm capitalize outline-none focus:border-primary"
        value={month}
        onChange={(e) => onChange(Number(e.target.value), year)}
      >
        {months.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border border-border bg-white px-2 text-sm outline-none focus:border-primary"
        value={year}
        onChange={(e) => onChange(month, Number(e.target.value))}
      >
        {years.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <button
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        onClick={goNext}
        title="Mes siguiente"
        type="button"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
