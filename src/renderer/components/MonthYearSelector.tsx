import { format } from "date-fns";
import { es } from "date-fns/locale";

const months = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;
  return {
    value: month,
    label: format(new Date(2026, index, 1), "LLLL", { locale: es }),
  };
});

const years = [2023, 2024, 2025, 2026, 2027];

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
  return (
    <div className="flex items-center gap-2">
      <select
        className="h-9 rounded-md border border-border bg-white px-3 text-sm capitalize outline-none focus:border-primary"
        value={month}
        onChange={(event) => onChange(Number(event.target.value), year)}
      >
        {months.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
        value={year}
        onChange={(event) => onChange(month, Number(event.target.value))}
      >
        {years.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}

