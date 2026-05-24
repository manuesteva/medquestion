import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { startSimulado } from "@/lib/simulado.functions";
import { recordAttempt } from "@/lib/practice.functions";
import { Loader2, Timer, ArrowRight, ArrowLeft, Trophy, CheckCircle2, XCircle, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/simulado")({
  component: Simulado,
  validateSearch: (s: Record<string, unknown>) => ({
    count: Math.max(1, Math.min(500, Number(s.count) || 20)),
    minutes: Math.max(1, Math.min(600, Number(s.minutes) || 30)),
  }),
});

function Simulado() {
  const { count, minutes } = Route.useSearch();
  const navigate = useNavigate();
  const startFn = useServerFn(startSimulado);
  const attemptFn = useServerFn(recordAttempt);

  const { data, isLoading } = useQuery({
    queryKey: ["sim", count],
    queryFn: () => startFn({ data: { count } }),
    staleTime: Infinity,
  });

  const questions = data?.questions ?? [];
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<{ correct: number; total: number; usedSec: number } | null>(null);
  const totalSec = minutes * 60;
  const [remaining, setRemaining] = useState(totalSec);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (remaining === 0 && !finished) void finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const q = questions[idx];
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const lowTime = remaining < 60;

  async function finish() {
    if (submitting) return;
    setSubmitting(true);
    const used = totalSec - remaining;
    let correct = 0;
    try {
      for (const qq of questions) {
        const picked = picks[qq.id];
        if (!picked) continue;
        try {
          const r = await attemptFn({ data: { questionId: qq.id, optionId: picked, timeMs: 0 } });
          if (r.is_correct) correct++;
        } catch {}
      }
      setResults({ correct, total: questions.length, usedSec: used });
      setFinished(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (questions.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">Sem questões disponíveis. Envie uma prova primeiro.</p>
        <Link to="/upload" className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Enviar prova
        </Link>
      </div>
    );
  }

  if (finished && results) {
    const pct = Math.round((results.correct / Math.max(1, results.total)) * 100);
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Trophy className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Simulado finalizado</h1>
          <p className="mt-2 text-sm text-muted-foreground">Confira seu desempenho abaixo.</p>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-3">
          <Big label="Acertos" value={`${results.correct}/${results.total}`} />
          <Big label="Aproveitamento" value={`${pct}%`} />
          <Big label="Tempo usado" value={`${Math.floor(results.usedSec / 60)}m`} />
        </div>
        <div className="mt-8 flex justify-center gap-3">
          <button onClick={() => navigate({ to: "/dashboard" })} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Voltar ao dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:px-6">
      {/* Timer header */}
      <div className="sticky top-16 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-base font-bold tabular-nums ${
          lowTime ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
        }`}>
          <Timer className="h-4 w-4" /> {mm}:{ss}
        </div>
        <div className="text-sm text-muted-foreground">
          {idx + 1} / {questions.length}
        </div>
        <button
          onClick={finish}
          disabled={submitting}
          className="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          Finalizar
        </button>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full bg-primary transition-all" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
      </div>

      <article className="mt-5 rounded-[20px] border border-border bg-card p-5 sm:p-7">
        {q.subject && (
          <span className="inline-block rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            {q.subject}
          </span>
        )}
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.75] sm:text-base">{q.statement}</p>

        <div className="mt-6 space-y-2.5">
          {q.question_options.map((o) => {
            const sel = picks[q.id] === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setPicks((p) => ({ ...p, [q.id]: o.id }))}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition active:scale-[0.99] ${
                  sel ? "border-primary bg-accent/40" : "border-border hover:border-primary/40"
                }`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border text-xs font-bold ${
                  sel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                }`}>{o.label}</span>
                <span className="text-sm leading-relaxed">{o.text}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-4 py-2 text-sm disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" /> Anterior
          </button>
          {idx < questions.length - 1 ? (
            <button
              onClick={() => setIdx((i) => i + 1)}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Próxima <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Finalizar <CheckCircle2 className="h-4 w-4" /></>}
            </button>
          )}
        </div>
      </article>
    </div>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
