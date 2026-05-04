type MoneyTextProps = {
  value: number;
  className?: string;
};

const formatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

export function MoneyText({ value, className }: MoneyTextProps) {
  return <span className={className}>{formatter.format(value)}</span>;
}

