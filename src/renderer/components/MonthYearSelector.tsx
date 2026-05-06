import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../lib/utils";
import { Button, buttonVariants } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

const MONTHS_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const MONTHS_FULL = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Setiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

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
  const [open, setOpen] = useState(false);
  const [menuYear, setMenuYear] = useState(year);

  useEffect(() => {
    setMenuYear(year);
  }, [year]);

  const monthLabel = useMemo(() => MONTHS_FULL[month - 1] ?? "", [month]);

  function handleSelect(nextMonth: number) {
    onChange(nextMonth, menuYear);
    setOpen(false);
  }

  function shiftMonth(direction: -1 | 1) {
    const nextMonth = month + direction;

    if (nextMonth < 1) {
      onChange(12, year - 1);
      return;
    }

    if (nextMonth > 12) {
      onChange(1, year + 1);
      return;
    }

    onChange(nextMonth, year);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex h-9 items-center overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <button
          aria-label="Mes anterior"
          className="flex h-full w-8 items-center justify-center border-r border-border text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          onClick={() => shiftMonth(-1)}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </button>

        <PopoverTrigger asChild>
          <button
            aria-label="Seleccionar periodo"
            className="flex h-full min-w-[134px] items-center justify-center gap-2 px-3 text-left transition-colors hover:bg-muted/40"
            type="button"
          >
            <span className="text-[15px] font-medium tracking-tight text-foreground">{monthLabel}</span>
            <span className="text-[15px] font-medium tracking-tight text-foreground">{year}</span>
            <ChevronDown aria-hidden="true" className="ml-0.5 h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>

        <button
          aria-label="Mes siguiente"
          className="flex h-full w-8 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          onClick={() => shiftMonth(1)}
          type="button"
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <PopoverContent align="center" className="w-[248px] rounded-lg p-2.5">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <Button
              size="sm"
              variant="ghost"
              className="size-7 rounded-full px-0"
              onClick={() => setMenuYear((current) => current - 1)}
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground">{menuYear}</span>
            <Button
              size="sm"
              variant="ghost"
              className="size-7 rounded-full px-0"
              onClick={() => setMenuYear((current) => current + 1)}
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {MONTHS_SHORT.map((label, index) => {
              const itemMonth = index + 1;
              const selected = itemMonth === month && menuYear === year;

              return (
                <button
                  key={`${menuYear}-${itemMonth}`}
                  className={cn(
                    buttonVariants({ variant: selected ? "primary" : "ghost", size: "sm" }),
                    "h-9 rounded-lg px-0 text-xs font-medium",
                    selected && "shadow-sm",
                    !selected && "border border-transparent text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground",
                  )}
                  onClick={() => handleSelect(itemMonth)}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
