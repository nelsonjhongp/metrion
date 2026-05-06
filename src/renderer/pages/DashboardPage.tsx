import { AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardData, DashboardSeriesPoint } from "../../shared/types";
import { MoneyText } from "../components/MoneyText";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../components/ui/chart";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils";
import { useAppStore } from "../stores/app-store";

const MONTHS = [
  "",
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

const percentFormatter = new Intl.NumberFormat("es-PE", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

const compactNumberFormatter = new Intl.NumberFormat("es-PE", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const trendChartConfig = {
  totalPurchases: {
    label: "Compras",
    color: "var(--chart-1)",
  },
  totalSales: {
    label: "Ventas",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const taxChartConfig = {
  totalPagar: {
    label: "Impuesto estimado",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function DashboardPage() {
  const { businessUnitId, month, profileId, year } = useAppStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!profileId || !businessUnitId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextData = await window.metrion.getDashboardData({
        profileId,
        businessUnitId,
        month,
        year,
      });
      setData(nextData);
    } catch {
      setError("No se pudo cargar el dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [businessUnitId, month, profileId, year]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const currentLabel = `${MONTHS[month] ?? ""} ${year}`;
  const trendSeries = useMemo(
    () =>
      data?.series.map((point) => ({
        ...point,
        period: point.label,
      })) ?? [],
    [data?.series],
  );
  const supplierPieData = useMemo(() => {
    if (!data?.topSuppliers.length) {
      return [];
    }

    const visibleSuppliers = data.topSuppliers.slice(0, 5);
    const remainingSuppliers = data.topSuppliers.slice(5);
    const palette = [
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
      "hsl(var(--muted-foreground) / 0.35)",
    ];

    const base = visibleSuppliers.map((supplier, index) => ({
      key: supplier.supplierKey,
      name: supplier.supplierName,
      amount: supplier.totalAmount,
      share: supplier.share,
      fill: palette[index] ?? palette[palette.length - 1],
    }));

    if (!remainingSuppliers.length) {
      return base;
    }

    const othersAmount = remainingSuppliers.reduce((sum, supplier) => sum + supplier.totalAmount, 0);
    const othersShare = remainingSuppliers.reduce((sum, supplier) => sum + supplier.share, 0);

    return [
      ...base,
      {
        key: "others",
        name: "Otros",
        amount: othersAmount,
        share: othersShare,
        fill: palette[5],
      },
    ];
  }, [data?.topSuppliers]);
  const supplierPieConfig = useMemo(
    () =>
      supplierPieData.reduce<ChartConfig>((config, supplier) => {
        config[supplier.key] = {
          label: supplier.name,
          color: supplier.fill,
        };
        return config;
      }, {}),
    [supplierPieData],
  );
  const topSupplierLead = data?.topSuppliers[0] ?? null;

  if (!profileId || !businessUnitId) {
    return (
      <section className="max-w-4xl">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <Card className="mt-4 flex flex-col items-center justify-center gap-2 p-10 text-center">
          <p className="text-sm font-medium text-foreground">Selecciona perfil y unidad</p>
          <p className="text-xs text-muted-foreground">Usa los filtros superiores para cargar el resumen.</p>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        className="border-b border-border/80 pb-4"
        description="Indicadores del periodo"
        title={`Resumen de ${currentLabel.toLowerCase()}`}
        titleAdornment={(
          <Badge variant={data?.current.isClosed ? "neutral" : "success"} className="shrink-0">
            {data?.current.isClosed ? "cerrado" : "abierto"}
          </Badge>
        )}
      />

      {error && (
        <div aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Compras del mes"
              value={<MoneyText value={data.current.totalPurchases} />}
              icon={ShoppingBag}
              tone="default"
              comparison={data.comparisons.totalPurchases}
            />
            <KpiCard
              label="Ventas del mes"
              value={<MoneyText value={data.current.totalSales} />}
              icon={BarChart3}
              tone="default"
              comparison={data.comparisons.totalSales}
            />
            <KpiCard
              label="Total a pagar"
              value={<MoneyText value={data.current.totalPagar} />}
              icon={AlertCircle}
              tone="muted"
              comparison={data.comparisons.totalPagar}
            />
            <KpiCard
              label="Diferencia"
              value={<MoneyText value={data.current.difference} />}
              icon={data.current.difference >= 0 ? ArrowUpRight : ArrowDownRight}
              tone={data.current.difference >= 0 ? "positive" : "negative"}
              comparison={data.comparisons.difference}
            />
          </div>

          <Card className="overflow-hidden border-[#d9dfdc] bg-white">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Compras vs ventas</h2>
                <p className="text-xs text-muted-foreground">Últimos 12 periodos hasta {currentLabel}</p>
              </div>
            </div>
            <div className="p-5">
              <TrendChart series={trendSeries} />
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.32fr_0.98fr]">
            <Card className="overflow-hidden border-[#d9dfdc] bg-white">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">Impuesto estimado</h2>
                <p className="text-xs text-muted-foreground">Total a pagar por periodo</p>
              </div>
              <div className="p-5">
                <TaxBarsChart series={trendSeries} />
              </div>
            </Card>

            <Card className="overflow-hidden border-[#d9dfdc] bg-white">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">Top proveedores</h2>
                  <p className="truncate text-xs text-muted-foreground">Ranking anual por monto de compras</p>
                </div>
                <Badge variant="secondary" className="shrink-0">Base: compras</Badge>
              </div>
              <div className="px-5 py-5">
                <SupplierPieChart
                  config={supplierPieConfig}
                  currentYear={year}
                  leadSupplier={topSupplierLead}
                  rows={supplierPieData}
                />
              </div>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  comparison,
  tone,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: ReactNode;
  comparison: DashboardData["comparisons"]["totalPurchases"];
  tone: "default" | "muted" | "positive" | "negative";
}) {
  const toneClasses = {
    default: "border-border bg-white text-[#115e59]",
    muted: "border-[#dde3ea] bg-[#fbfcfd] text-[#475569]",
    positive: "border-[#dcebdd] bg-[#fbfdfb] text-[#166534]",
    negative: "border-[#eed7d7] bg-[#fffafb] text-[#b42318]",
  } satisfies Record<"default" | "muted" | "positive" | "negative", string>;

  return (
    <Card className={cn("overflow-hidden border", toneClasses[tone])}>
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <div className="mt-2 text-[2rem] font-semibold tracking-tight text-foreground">{value}</div>
          <p className="mt-2 truncate text-xs text-muted-foreground">
            {formatComparison(comparison)}
          </p>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[#f6f8f8] text-current/80">
          <Icon className="size-[18px]" />
        </div>
      </div>
    </Card>
  );
}

function TrendChart({ series }: { series: Array<DashboardSeriesPoint & { period: string }> }) {
  const hasValues = series.some((point) => point.totalPurchases > 0 || point.totalSales > 0);

  if (!hasValues) {
    return <ChartEmptyState message="Aún no hay suficientes periodos con compras o ventas." />;
  }

  return (
    <ChartContainer className="h-72 w-full" config={trendChartConfig}>
      <LineChart accessibilityLayer data={series} margin={{ top: 12, right: 8, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="4 6" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="period"
          tickLine={false}
          tickMargin={10}
          tickFormatter={(value: string) => value}
        />
        <YAxis
          axisLine={false}
          tickFormatter={(value: number) => formatCompactCurrency(value)}
          tickLine={false}
          tickMargin={10}
          width={58}
        />
        <ChartTooltip
          content={(
            <ChartTooltipContent
              formatter={(value, _name, item) => (
                <div className="flex min-w-[11rem] items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {(trendChartConfig as ChartConfig)[String(item.dataKey)]?.label ?? String(item.name)}
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {currencyFormatter.format(Number(value ?? 0))}
                  </span>
                </div>
              )}
              labelFormatter={(label) => `Periodo ${String(label)}`}
            />
          )}
        />
        <Line
          dataKey="totalPurchases"
          dot={{ fill: "var(--color-totalPurchases)", r: 3, strokeWidth: 0 }}
          name="Compras"
          stroke="var(--color-totalPurchases)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
          type="monotone"
        />
        <Line
          dataKey="totalSales"
          dot={{ fill: "var(--color-totalSales)", r: 3, strokeWidth: 0 }}
          name="Ventas"
          stroke="var(--color-totalSales)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
          type="monotone"
        />
      </LineChart>
    </ChartContainer>
  );
}

function TaxBarsChart({ series }: { series: Array<DashboardSeriesPoint & { period: string }> }) {
  const maxValue = Math.max(...series.map((point) => point.totalPagar), 0);

  if (maxValue === 0) {
    return <ChartEmptyState message="Todavía no hay impuestos calculados en el rango mostrado." />;
  }

  return (
    <ChartContainer className="h-[21rem] w-full" config={taxChartConfig}>
      <BarChart accessibilityLayer data={series} margin={{ top: 28, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 6" vertical={false} />
        <XAxis axisLine={false} dataKey="period" tickLine={false} tickMargin={10} />
        <YAxis
          axisLine={false}
          tickFormatter={(value: number) => formatCompactCurrency(value)}
          tickLine={false}
          tickMargin={10}
          width={58}
        />
        <ChartTooltip
          content={(
            <ChartTooltipContent
              formatter={(value) => (
                <div className="flex min-w-[11rem] items-center justify-between gap-4">
                  <span className="text-muted-foreground">Total a pagar</span>
                  <span className="font-mono font-medium text-foreground">
                    {currencyFormatter.format(Number(value ?? 0))}
                  </span>
                </div>
              )}
              labelFormatter={(label) => `Periodo ${String(label)}`}
            />
          )}
        />
        <Bar
          dataKey="totalPagar"
          fill="var(--color-totalPagar)"
          maxBarSize={36}
          name="Impuesto estimado"
          radius={[14, 14, 10, 10]}
        >
          <LabelList
            content={({ value, x, y, width }) => {
              const numericValue = Number(value ?? 0);
              const centerX = Number(x ?? 0) + Number(width ?? 0) / 2;
              const labelY = Number(y ?? 0) - 10;

              return (
                <text
                  className="fill-muted-foreground text-[10px] font-medium"
                  textAnchor="middle"
                  x={centerX}
                  y={labelY}
                >
                  {numericValue > 0 ? formatShortCurrency(numericValue) : "—"}
                </text>
              );
            }}
            dataKey="totalPagar"
            position="top"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function SupplierPieChart({
  config,
  currentYear,
  leadSupplier,
  rows,
}: {
  config: ChartConfig;
  currentYear: number;
  leadSupplier: DashboardData["topSuppliers"][number] | null;
  rows: Array<{ key: string; name: string; amount: number; share: number; fill: string }>;
}) {
  if (!rows.length) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border bg-[#fafbfa] px-4 text-center text-sm text-muted-foreground">
        Sin datos suficientes para graficar proveedores.
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <ChartContainer className="mx-auto h-56 w-full max-w-[18rem]" config={config}>
        <PieChart accessibilityLayer>
          <ChartTooltip
            content={(
              <ChartTooltipContent
                formatter={(value, _name, item) => {
                  const payload = item.payload as { name: string; share: number };
                  return (
                    <div className="flex min-w-[12rem] items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-foreground">{payload.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {percentFormatter.format(payload.share)}
                        </p>
                      </div>
                      <span className="font-mono font-medium text-foreground">
                        {currencyFormatter.format(Number(value ?? 0))}
                      </span>
                    </div>
                  );
                }}
                hideLabel
              />
            )}
          />
          <Pie data={rows} dataKey="amount" innerRadius={56} outerRadius={82} strokeWidth={4}>
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                return (
                  <text textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                    <tspan className="fill-foreground text-[28px] font-semibold" x={viewBox.cx} y={viewBox.cy}>
                      {rows.length}
                    </tspan>
                    <tspan className="fill-muted-foreground text-[11px]" x={viewBox.cx} y={(viewBox.cy ?? 0) + 18}>
                      segmentos
                    </tspan>
                  </text>
                );
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      <div className="rounded-[26px] border border-border bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="space-y-3">
          {rows.map((row) => (
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-sm" key={row.key}>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.fill }} />
                <span className="truncate text-foreground">{row.name}</span>
              </div>
              <span className="shrink-0 text-sm font-medium text-foreground">
                {percentFormatter.format(row.share)}
              </span>
              <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {formatShortCurrency(row.amount)}
              </span>
            </div>
          ))}
        </div>
        {leadSupplier ? (
          <div className="mt-4 rounded-2xl bg-[#f7faf9] px-3.5 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Mayor participación {currentYear}</p>
            <p className="mt-1 truncate text-sm font-medium text-foreground">{leadSupplier.supplierName}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {percentFormatter.format(leadSupplier.share)} · {currencyFormatter.format(leadSupplier.totalAmount)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="p-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-4 h-8 w-36" />
            <Skeleton className="mt-3 h-3 w-24" />
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-4 h-64 w-full" />
      </Card>
      <div className="grid gap-4 xl:grid-cols-[1.32fr_0.98fr]">
        <Card className="p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-72 w-full" />
        </Card>
        <Card className="p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-72 w-full" />
        </Card>
      </div>
    </div>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-border bg-[#fafbfa] px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function formatComparison(comparison: DashboardData["comparisons"]["totalPurchases"]) {
  if (!comparison.hasComparison || comparison.delta === null) {
    return "Sin periodo anterior comparable";
  }

  if (comparison.delta === 0) {
    return `Sin cambio vs. ${comparison.previousLabel?.toLowerCase()}`;
  }

  if (comparison.deltaPercent !== null) {
    const direction = comparison.delta > 0 ? "más" : "menos";
    return `${percentFormatter.format(Math.abs(comparison.deltaPercent))} ${direction} que ${comparison.previousLabel?.toLowerCase()}`;
  }

  const direction = comparison.delta > 0 ? "más" : "menos";
  return `${currencyFormatter.format(Math.abs(comparison.delta))} ${direction} que ${comparison.previousLabel?.toLowerCase()}`;
}

function formatCompactCurrency(value: number) {
  if (value === 0) return "S/ 0";
  return `S/ ${compactNumberFormatter.format(value)}`;
}

function formatShortCurrency(value: number) {
  if (value === 0) return "S/ 0";
  if (value >= 1000) {
    return `S/ ${compactNumberFormatter.format(value)}`;
  }
  return `S/ ${Math.round(value)}`;
}
