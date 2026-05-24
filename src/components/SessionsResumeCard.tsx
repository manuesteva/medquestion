import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getActiveSession } from "@/lib/sessions.functions";
import { PlayCircle, Timer, ArrowRight } from "lucide-react";

const KIND_LABEL: Record<string, string> = {
  simulado: "Simulado cronometrado",
  practice: "Prática",
  review: "Revisão",
};

export function SessionsResumeCard() {
  const fn = useServerFn(getActiveSession);
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["active-session"],
    queryFn: () => fn({ data: {} }),
    refetchOnWindowFocus: true,
  });

  if (!data) return null;
  const session = data;

  const total = (session.question_ids as string[]).length;
  const cur = Math.min(total, (session.current_index ?? 0) + 1);
  const progressPct = Math.round((cur / Math.max(1, total)) * 100);
  const isSimulado = session.kind === "simulado";
  const remaining = isSimulado
    ? Math.max(0, (session.time_limit_sec ?? 0) - (session.elapsed_sec ?? 0))
    : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  function resume() {
    if (session.kind === "simulado") {
      navigate({ to: "/simulado", search: { count: 1, minutes: 1, resume: session.id } as never });
    } else {
      navigate({ to: "/practice" });
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[20px] border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <PlayCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            {session.status === "paused" ? "Sessão pausada" : "Continue de onde parou"}
          </div>
          <div className="mt-0.5 text-base font-bold">{KIND_LABEL[session.kind] ?? session.kind}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              Progresso {cur}/{total}
            </span>
            {isSimulado && (
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3 w-3" /> {mm}:{ss} restantes
              </span>
            )}
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
      <button
        onClick={resume}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Continuar <ArrowRight className="h-4 w-4" />
      </button>
    </section>
  );
}
