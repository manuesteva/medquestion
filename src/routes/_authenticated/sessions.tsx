import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listSessions, deleteSession } from "@/lib/sessions.functions";
import { Loader2, PlayCircle, Trophy, Pause, Trash2, History } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sessions")({ component: SessionsPage });

const KIND_LABEL: Record<string, string> = {
  simulado: "Simulado",
  practice: "Prática",
  review: "Revisão",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  paused: "Pausada",
  finished: "Finalizada",
};

function SessionsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(listSessions);
  const delFn = useServerFn(deleteSession);
  const { data, isLoading } = useQuery({ queryKey: ["sessions-list"], queryFn: () => fn() });

  async function remove(id: string) {
    try {
      await delFn({ data: { id } });
      toast.success("Sessão removida");
      qc.invalidateQueries({ queryKey: ["sessions-list"] });
      qc.invalidateQueries({ queryKey: ["active-session"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  function open(s: NonNullable<typeof data>[number]) {
    if (s.kind === "simulado" && s.status !== "finished") {
      navigate({ to: "/simulado", search: { count: 1, minutes: 1, resume: s.id } as never });
    } else {
      navigate({ to: "/dashboard" });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[11px] font-medium text-accent-foreground">
        <History className="h-3.5 w-3.5" /> Histórico
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Minhas sessões</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Retome o que ficou pendente ou revise seus simulados anteriores.
      </p>

      {isLoading ? (
        <div className="mt-12 grid place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Você ainda não tem sessões registradas.
        </div>
      ) : (
        <ul className="mt-6 space-y-2.5">
          {data!.map((s) => {
            const total = (s.question_ids as string[]).length;
            const cur = Math.min(total, (s.current_index ?? 0) + 1);
            const date = new Date(s.last_activity_at).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
            const Icon =
              s.status === "finished" ? Trophy : s.status === "paused" ? Pause : PlayCircle;
            const iconClass =
              s.status === "finished"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : s.status === "paused"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-primary/15 text-primary";
            return (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {KIND_LABEL[s.kind] ?? s.kind}
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {s.status === "finished"
                      ? `${s.correct_count}/${total} acertos`
                      : `Progresso ${cur}/${total}`}
                    {" · "}
                    {date}
                  </div>
                </div>
                {s.status !== "finished" && s.kind === "simulado" && (
                  <button
                    onClick={() => open(s)}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Continuar
                  </button>
                )}
                <button
                  onClick={() => remove(s.id)}
                  aria-label="Remover"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
