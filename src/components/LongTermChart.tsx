import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getLongTermProgress } from "@/lib/stats.functions";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  ComposedChart,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function LongTermChart() {
  const fn = useServerFn(getLongTermProgress);
  const { data, isLoading } = useQuery({ queryKey: ["long-term"], queryFn: () => fn() });
  const [mode, setMode] = useState<"weekly" | "monthly">("monthly");

  if (isLoading || !data) {
    return (
      <div className="h-48 animate-pulse rounded-[20px] border border-border bg-card" />
    );
  }

  const series = mode === "weekly" ? data.weekly : data.monthly;
  const recent = series.filter((b) => b.total > 0).slice(-2);
  let delta: number | null = null;
  if (recent.length === 2) delta = recent[1].accuracy - recent[0].accuracy;

  const totalAnswered = series.reduce((s, b) => s + b.total, 0);

  return (
    <section className="rounded-[20px] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold">Evolução</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Curva de aprendizado nas últimas {mode === "weekly" ? "12 semanas" : "6 meses"}
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border bg-secondary p-0.5 text-xs font-medium">
          <button
            onClick={() => setMode("weekly")}
            className={`rounded-full px-3 py-1 transition ${
              mode === "weekly" ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            Semanal
          </button>
          <button
            onClick={() => setMode("monthly")}
            className={`rounded-full px-3 py-1 transition ${
              mode === "monthly" ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            Mensal
          </button>
        </div>
      </div>

      {totalAnswered === 0 ? (
        <div className="grid h-44 place-items-center text-sm text-muted-foreground">
          Sem dados ainda — pratique para começar a ver sua evolução
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-baseline gap-3">
            <div className="text-3xl font-bold tracking-tight">
              {Math.round(
                (series.reduce((s, b) => s + b.correct, 0) / Math.max(1, totalAnswered)) * 100,
              )}
              %
            </div>
            <div className="text-xs text-muted-foreground">acerto no período</div>
            {delta !== null && (
              <div
                className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  delta > 0
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : delta < 0
                      ? "bg-destructive/10 text-destructive"
                      : "bg-accent text-muted-foreground"
                }`}
              >
                {delta > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : delta < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {delta > 0 ? "+" : ""}
                {delta} pp
              </div>
            )}
          </div>

          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="total" fill="var(--color-primary)" opacity={0.25} radius={[6, 6, 0, 0]} />
                <Bar dataKey="correct" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
