import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/stats.functions";
import { getMyContext } from "@/lib/profile.functions";
import { useAuth } from "@/hooks/use-auth";
import { SessionsResumeCard } from "@/components/SessionsResumeCard";
import { LongTermChart } from "@/components/LongTermChart";
import {
  Upload, ArrowRight, Brain, RotateCcw, Bookmark, Target, TrendingUp, Timer, Flame,
  Timer as TimerIcon, BookOpen, ChevronRight, Check, X, Clock, History,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

type Gender = "female" | "male" | "neutral";

function welcomeText(g: Gender | undefined) {
  if (g === "female") return "Olá, bem-vinda! 👋";
  if (g === "male") return "Olá, bem-vindo! 👋";
  return "Olá! 👋";
}
function congratsText(g: Gender | undefined) {
  if (g === "female") return "Meta atingida! Parabéns, você arrasou!";
  if (g === "male") return "Meta atingida! Parabéns, você mandou bem!";
  return "Meta atingida! Excelente trabalho!";
}

function Dashboard() {
  const { user } = useAuth();
  const fn = useServerFn(getDashboardStats);
  const ctxFn = useServerFn(getMyContext);
  const { data, isLoading } = useQuery({ queryKey: ["stats"], queryFn: () => fn() });
  const ctx = useQuery({ queryKey: ["my-context", user?.id], queryFn: () => ctxFn(), enabled: !!user });
  const navigate = useNavigate();
  const [reviewModal, setReviewModal] = useState(false);
  const [simModal, setSimModal] = useState(false);

  const gender = ctx.data?.profile?.gender as Gender | undefined;

  if (isLoading || !data) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;
  }

  const empty = data.totalQuestions === 0;
  const goalPct = Math.min(100, Math.round((data.todayCount / Math.max(1, data.dailyGoal)) * 100));
  const goalReached = data.todayCount >= data.dailyGoal;

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-7">
      <SessionsResumeCard />

      {/* Banner */}
      <section className="relative overflow-hidden rounded-[20px] border border-border bg-gradient-to-br from-[#dbeafe] via-[#eff6ff] to-[#e0f2fe] p-6 dark:from-[#1e3a5f] dark:via-[#1e3058] dark:to-[#0c3459]">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          {welcomeText(gender)}
        </p>
        <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight sm:text-3xl">
          {empty ? (
            <>Comece sua jornada de <span className="text-primary">estudo</span></>
          ) : (
            <>Bora <span className="text-primary">estudar</span> hoje?</>
          )}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.totalQuestions} questões no banco · {data.total} resolvidas
        </p>
        <Link
          to={empty ? "/upload" : "/practice"}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-95 hover:bg-primary/90"
        >
          {empty ? "Enviar primeira prova" : "Continuar praticando"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ações rápidas
        </h2>
        <div className="space-y-2.5">
          <ActionCard
            icon={<Brain className="h-5 w-5" />}
            iconBg="bg-[#dbeafe] text-primary dark:bg-[#1e3a5f] dark:text-primary"
            title="Continuar estudando"
            sub="Próxima sessão"
            onClick={() => navigate({ to: "/practice" })}
          />
          <ActionCard
            icon={<RotateCcw className="h-5 w-5" />}
            iconBg="bg-[#fef2f2] text-destructive dark:bg-[#450a0a] dark:text-destructive"
            title="Revisar erradas"
            sub="Revise as questões que você errou"
            onClick={() => setReviewModal(true)}
          />
          <ActionCard
            icon={<Clock className="h-5 w-5" />}
            iconBg="bg-amber-500/15 text-amber-600 dark:text-amber-400"
            title="Rever depois"
            sub="Questões salvas para revisar"
            onClick={() => navigate({ to: "/practice", search: { reviewLater: "1" } as never })}
          />
          <ActionCard
            icon={<Bookmark className="h-5 w-5" />}
            iconBg="bg-[#ccfbf1] text-[#0d9488] dark:bg-[#064e3b] dark:text-emerald-300"
            title="Favoritas"
            sub="Suas marcadas"
            onClick={() => navigate({ to: "/practice", search: { favorites: true } as never })}
          />
          <ActionCard
            icon={<History className="h-5 w-5" />}
            iconBg="bg-violet-500/15 text-violet-600 dark:text-violet-400"
            title="Minhas sessões"
            sub="Histórico e sessões pausadas"
            onClick={() => navigate({ to: "/sessions" })}
          />
        </div>
      </section>

      {/* Daily Goal */}
      <section className="rounded-[20px] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="text-base font-bold">Meta do dia</h3>
          </div>
          {goalReached && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--color-success)]">
              <Check className="h-3 w-3" /> Concluída
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {goalReached ? congratsText(gender) : `Responda ${data.dailyGoal} questões hoje`}
        </p>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${goalPct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">{data.todayCount} de {data.dailyGoal} questões</span>
          <span className="text-muted-foreground">{goalPct}%</span>
        </div>
      </section>

      {/* Stats */}
      <section>
        <h2 className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Estatísticas
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard icon={<Target className="h-4 w-4" />} label="Respondidas" value={data.total} sub="Total" />
          <StatCard
            highlight
            icon={<TrendingUp className="h-4 w-4" />}
            label="Taxa de acerto"
            value={`${data.accuracy}%`}
            sub={`${data.correct} acertos`}
          />
          <StatCard icon={<Timer className="h-4 w-4" />} label="Tempo médio" value={`${data.avgTimeSec}s`} sub="Por questão" />
          <StatCard icon={<Flame className="h-4 w-4" />} label="Sequência" value={`${data.streak}d`} sub="Streak atual" />
        </div>
      </section>

      {/* Simulado */}
      <section className="rounded-[20px] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#dbeafe] text-primary dark:bg-[#1e3a5f]">
            <TimerIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold">Simulado cronometrado</h3>
            <p className="text-sm text-muted-foreground">Treine como na prova real</p>
          </div>
        </div>
        <button
          onClick={() => setSimModal(true)}
          disabled={empty}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] hover:bg-primary/90 disabled:opacity-50"
        >
          Iniciar simulado <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      {/* Weekly chart */}
      <section className="rounded-[20px] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <h3 className="text-base font-bold">Desempenho da semana</h3>
        <p className="text-sm text-muted-foreground">Acertos e erros por dia</p>
        <div className="mt-4 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.weekly} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="correct" name="Acertos" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="wrong" name="Erros" stroke="var(--color-destructive)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Subjects */}
      <section className="rounded-[20px] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-base font-bold">Por matéria</h3>
        </div>
        <p className="text-sm text-muted-foreground">Forças e fraquezas</p>
        {data.subjects.length === 0 ? (
          <p className="mt-4 rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
            Responda questões para ver suas matérias aqui.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.subjects.slice(0, 6).map((s) => (
              <li key={s.subject}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{s.subject}</span>
                  <span className="text-muted-foreground">{s.accuracy}% · {s.total}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full ${s.accuracy >= 70 ? "bg-[var(--color-success)]" : s.accuracy >= 50 ? "bg-primary" : "bg-destructive"}`}
                    style={{ width: `${s.accuracy}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {reviewModal && (
        <CountModal
          title="Revisar erradas"
          subtitle="Quantas questões você quer revisar?"
          options={[10, 20, 30, 0]}
          onClose={() => setReviewModal(false)}
          onPick={(n) => {
            setReviewModal(false);
            navigate({ to: "/practice", search: { wrong: true } as never });
          }}
        />
      )}
      {simModal && (
        <SimuladoModal
          totalAvailable={data.totalQuestions}
          onClose={() => setSimModal(false)}
          onStart={(count, minutes) => {
            setSimModal(false);
            navigate({ to: "/simulado", search: { count, minutes } as never });
          }}
        />
      )}
    </div>
  );
}

function ActionCard({
  icon, iconBg, title, sub, onClick,
}: { icon: React.ReactNode; iconBg: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-[18px] border border-border bg-card p-4 text-left transition active:scale-[0.99] hover:border-primary/40 hover:shadow-[var(--shadow-soft)]"
    >
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold leading-tight">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function StatCard({
  icon, label, value, sub, highlight,
}: { icon: React.ReactNode; label: string; value: string | number; sub: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-[18px] border p-4 shadow-[var(--shadow-card)] ${
        highlight ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
      }`}
    >
      <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
        {icon}{label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      <div className={`mt-0.5 text-xs ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{sub}</div>
    </div>
  );
}

function CountModal({
  title, subtitle, options, onClose, onPick,
}: { title: string; subtitle: string; options: number[]; onClose: () => void; onPick: (n: number) => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/30 p-0 backdrop-blur-sm animate-fade-in sm:place-items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {options.map((n) => (
            <button
              key={n}
              onClick={() => onPick(n)}
              className="rounded-xl border border-border bg-secondary p-4 text-center font-semibold transition active:scale-95 hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              {n === 0 ? "Todas" : n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const SIM_PREFS_KEY = "sim-prefs:v1";

function SimuladoModal({
  totalAvailable,
  onClose,
  onStart,
}: {
  totalAvailable: number;
  onClose: () => void;
  onStart: (count: number, minutes: number) => void;
}) {
  const maxCount = Math.max(1, totalAvailable);
  const [count, setCount] = useState(() => {
    try {
      const raw = localStorage.getItem(SIM_PREFS_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      const v = Number(saved?.count);
      if (Number.isFinite(v) && v >= 1) return Math.min(v, maxCount);
    } catch {}
    return Math.min(20, maxCount);
  });
  const [minutes, setMinutes] = useState(() => {
    try {
      const raw = localStorage.getItem(SIM_PREFS_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      const v = Number(saved?.minutes);
      if (Number.isFinite(v) && v >= 1) return v;
    } catch {}
    return 30;
  });

  function save(c: number, m: number) {
    try {
      localStorage.setItem(SIM_PREFS_KEY, JSON.stringify({ count: c, minutes: m }));
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/30 p-0 backdrop-blur-sm animate-fade-in sm:place-items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Configurar simulado</h2>
            <p className="mt-1 text-sm text-muted-foreground">Defina o tamanho e o tempo.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Número de questões
            </label>
            <span className="text-2xl font-bold tabular-nums text-primary">{count}</span>
          </div>
          <input
            type="range"
            min={1}
            max={maxCount}
            step={1}
            value={count}
            onChange={(e) => {
              const v = Number(e.target.value);
              setCount(v);
              save(v, minutes);
            }}
            className="mt-3 w-full accent-primary"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>1</span>
            <span>{maxCount} disponíveis</span>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tempo (minutos)
            </label>
            <span className="text-2xl font-bold tabular-nums text-primary">{minutes}</span>
          </div>
          <input
            type="range"
            min={1}
            max={Math.max(180, minutes)}
            step={1}
            value={minutes}
            onChange={(e) => {
              const v = Math.max(1, Number(e.target.value));
              setMinutes(v);
              save(count, v);
            }}
            className="mt-3 w-full accent-primary"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>1 min</span>
            <span>arraste livremente</span>
          </div>
        </div>

        <button
          onClick={() => {
            save(count, minutes);
            onStart(count, minutes);
          }}
          className="mt-7 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] hover:bg-primary/90"
        >
          Iniciar agora <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
