import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listQuestions,
  recordAttempt,
  toggleFavorite,
  saveNote,
  getNote,
  getFavorites,
  toggleReviewLater,
  getReviewLaterIds,
} from "@/lib/practice.functions";
import { explainQuestion } from "@/lib/explain.functions";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Bookmark, BookmarkPlus, Loader2, Sparkles, Upload, Flag,
  CheckCircle2, XCircle, Trophy, RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/practice")({
  component: Practice,
  validateSearch: (s: Record<string, unknown>) => ({
    favorites: s.favorites === "1" || s.favorites === true,
    wrong: s.wrong === "1" || s.wrong === true,
    unanswered: s.unanswered === "1" || s.unanswered === true,
    reviewLater: s.reviewLater === "1" || s.reviewLater === true,
    specialty: typeof s.specialty === "string" ? s.specialty : undefined,
    uploadIds: typeof s.uploadIds === "string" ? s.uploadIds : undefined,
  }),
});

type AttemptState = { selectedId: string | null; submitted: boolean; isCorrect: boolean | null };

function Practice() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const list = useServerFn(listQuestions);
  const attemptFn = useServerFn(recordAttempt);
  const favFn = useServerFn(toggleFavorite);
  const reviewFn = useServerFn(toggleReviewLater);
  const explainFn = useServerFn(explainQuestion);
  const getNoteFn = useServerFn(getNote);
  const saveNoteFn = useServerFn(saveNote);
  const favsFn = useServerFn(getFavorites);
  const reviewIdsFn = useServerFn(getReviewLaterIds);

  const uploadIdList = search.uploadIds
    ? search.uploadIds.split(",").filter((s: string) => s.length > 0)
    : undefined;
  const { data, isLoading } = useQuery({
    queryKey: ["questions", search],
    queryFn: () =>
      list({
        data: {
          onlyFavorites: !!search.favorites,
          onlyWrong: !!search.wrong,
          onlyUnanswered: !!search.unanswered,
          onlyReviewLater: !!search.reviewLater,
          specialty: search.specialty ?? null,
          uploadIds: uploadIdList,
          limit: 50,
        },
      }),
  });
  const favs = useQuery({ queryKey: ["favs"], queryFn: () => favsFn() });
  const reviews = useQuery({ queryKey: ["review-later-ids"], queryFn: () => reviewIdsFn() });

  const questions = data?.questions ?? [];
  const [idx, setIdx] = useState(0);
  const [states, setStates] = useState<Record<string, AttemptState>>({});
  const [explainOpen, setExplainOpen] = useState<Record<string, boolean>>({});
  const [explainCache, setExplainCache] = useState<Record<string, Awaited<ReturnType<typeof explainFn>>>>({});
  const [explainLoading, setExplainLoading] = useState<Record<string, boolean>>({});
  const [explainError, setExplainError] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [noteLoadedFor, setNoteLoadedFor] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [finished, setFinished] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const q = questions[idx];
  const cur: AttemptState = q ? states[q.id] ?? { selectedId: null, submitted: false, isCorrect: null } : { selectedId: null, submitted: false, isCorrect: null };
  const showExplain = q ? !!explainOpen[q.id] : false;

  // Load note for the current question (and only that one). Reset of UI state
  // happens synchronously in goTo() to avoid the "tap before reset" race.
  useEffect(() => {
    if (!q) return;
    if (noteLoadedFor === q.id) return;
    setNoteLoadedFor(q.id);
    void getNoteFn({ data: { questionId: q.id } }).then((b) => {
      // only apply if user hasn't navigated away
      setNote((cur) => (noteLoadedFor === q.id || cur === "" ? b : cur));
    });
  }, [q?.id, noteLoadedFor, getNoteFn, q]);

  const isFav = useMemo(() => (q ? favs.data?.has(q.id) : false), [favs.data, q]);
  const isReview = useMemo(() => (q ? reviews.data?.has(q.id) : false), [reviews.data, q]);

  // Synchronous navigation: persists note + resets per-question UI before render.
  function goTo(nextIdx: number) {
    if (nextIdx < 0 || nextIdx >= questions.length || !q) return;
    const noteSnapshot = note;
    const fromId = q.id;
    if (noteSnapshot && noteSnapshot.trim().length > 0) {
      void saveNoteFn({ data: { questionId: fromId, body: noteSnapshot } }).catch(() => {});
    }
    setNote("");
    setNoteLoadedFor(null);
    setStartedAt(Date.now());
    setIdx(nextIdx);
  }

  function setSelected(optId: string) {
    if (!q) return;
    setStates((s) => {
      const prev = s[q.id] ?? { selectedId: null, submitted: false, isCorrect: null };
      if (prev.submitted) return s;
      return { ...s, [q.id]: { ...prev, selectedId: optId } };
    });
  }

  async function submit() {
    if (!q || !cur.selectedId || cur.submitted || submitting) return;
    setSubmitting(true);
    const correctOpt = q.question_options.find((o) => o.is_correct);
    const optimisticCorrect = cur.selectedId === correctOpt?.id;
    const picked = cur.selectedId;
    setStates((s) => ({ ...s, [q.id]: { selectedId: picked, submitted: true, isCorrect: optimisticCorrect } }));
    try {
      const r = await attemptFn({
        data: { questionId: q.id, optionId: picked, timeMs: Date.now() - startedAt },
      });
      setStates((s) => ({ ...s, [q.id]: { selectedId: picked, submitted: true, isCorrect: r.is_correct } }));
      qc.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      setStates((s) => ({ ...s, [q.id]: { selectedId: picked, submitted: false, isCorrect: null } }));
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  function showExplanation() {
    if (!q || submitting) return;
    const qid = q.id;
    setExplainOpen((s) => ({ ...s, [qid]: true }));
    setExplainError((s) => {
      if (!s[qid]) return s;
      const { [qid]: _, ...rest } = s;
      return rest;
    });
    if (explainCache[qid] || explainLoading[qid]) return;
    setExplainLoading((s) => ({ ...s, [qid]: true }));
    explainFn({ data: { questionId: qid } })
      .then((r) => setExplainCache((c) => ({ ...c, [qid]: r })))
      .catch((e) =>
        setExplainError((s) => ({
          ...s,
          [qid]: e instanceof Error ? e.message : "Erro ao gerar explicação",
        })),
      )
      .finally(() => setExplainLoading((s) => ({ ...s, [qid]: false })));
  }

  function tryFinish() {
    const unanswered = questions.filter((qq) => !states[qq.id]?.submitted).length;
    if (unanswered > 0) {
      setConfirmFinish(true);
      return;
    }
    setFinished(true);
  }


  if (isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Nenhuma questão disponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Envie uma prova para começar a estudar ou ajuste os filtros.
        </p>
        <Link
          to="/upload"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          <Upload className="h-4 w-4" /> Enviar prova
        </Link>
      </div>
    );
  }

  if (finished) return <ResultsScreen questions={questions} states={states} />;

  if (!q) return null;
  const correctOpt = q.question_options.find((o) => o.is_correct);
  const explain = explainCache[q.id];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
        {/* MAIN */}
        <div className="min-w-0">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Questão {idx + 1} de {questions.length}</span>
              {q.subject && (
                <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                  {q.subject}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={async () => {
                  const r = await favFn({ data: { questionId: q.id } });
                  toast.success(r.favorited ? "Favoritada" : "Removida");
                  qc.invalidateQueries({ queryKey: ["favs"] });
                }}
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                className="grid h-11 w-11 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground active:scale-95"
                aria-label="Favoritar"
              >
                <Bookmark className={`h-5 w-5 ${isFav ? "fill-primary text-primary" : ""}`} />
              </button>
              <button
                type="button"
                onClick={async () => {
                  const r = await reviewFn({ data: { questionId: q.id } });
                  toast.success(r.marked ? "Adicionada a Rever depois" : "Removida de Rever depois");
                  qc.invalidateQueries({ queryKey: ["review-later-ids"] });
                  qc.invalidateQueries({ queryKey: ["review-later-count"] });
                }}
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                className="grid h-11 w-11 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground active:scale-95"
                aria-label="Rever depois"
              >
                <BookmarkPlus className={`h-5 w-5 ${isReview ? "fill-primary text-primary" : ""}`} />
              </button>
              <button
                type="button"
                onClick={tryFinish}
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                className="ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium transition hover:bg-accent active:scale-[0.97]"
              >
                <Flag className="h-3.5 w-3.5" /> Finalizar
              </button>

            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
            />
          </div>

          {/* Card */}
          <article className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7">
            <p className="whitespace-pre-wrap text-[15px] leading-[1.75] tracking-[-0.005em] text-foreground sm:text-base">
              {q.statement}
            </p>

            <div className="mt-7 space-y-2.5">
              {q.question_options.map((o) => {
                const isSel = cur.selectedId === o.id;
                const isCorrect = cur.submitted && o.is_correct;
                const isWrong = cur.submitted && isSel && !o.is_correct;
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={cur.submitted}
                    onClick={() => setSelected(o.id)}
                    style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                    className={`group flex w-full min-h-12 items-start gap-3 rounded-xl border p-4 text-left transition-colors duration-100 active:scale-[0.995] select-none ${
                      isCorrect
                        ? "border-[var(--color-success)] bg-[var(--color-success)]/10"
                        : isWrong
                          ? "border-destructive bg-destructive/10"
                          : isSel
                            ? "border-primary bg-accent/40"
                            : "border-border hover:border-foreground/20 hover:bg-accent/30"
                    }`}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border text-xs font-semibold transition-colors ${
                        isCorrect
                          ? "border-[var(--color-success)] bg-[var(--color-success)] text-[var(--color-success-foreground)]"
                          : isWrong
                            ? "border-destructive bg-destructive text-destructive-foreground"
                            : isSel
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background"
                      }`}
                    >
                      {o.label}
                    </span>
                    <span className="text-sm leading-relaxed">{o.text}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => goTo(idx - 1)}
                  disabled={idx === 0}
                  style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                  className="inline-flex min-h-12 items-center gap-1 rounded-lg border border-border bg-card px-4 py-2 text-sm transition hover:bg-accent active:scale-[0.97] disabled:opacity-40"
                >
                  <ArrowLeft className="h-4 w-4" /> Anterior
                </button>
                <button
                  type="button"
                  onClick={() => goTo(idx + 1)}
                  disabled={idx === questions.length - 1}
                  style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                  className="inline-flex min-h-12 items-center gap-1 rounded-lg border border-border bg-card px-4 py-2 text-sm transition hover:bg-accent active:scale-[0.97] disabled:opacity-40"
                >
                  Próxima <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              {!cur.submitted ? (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!cur.selectedId || submitting}
                  style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                  className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-[0.97] disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Responder
                </button>
              ) : (
                <button
                  type="button"
                  onClick={showExplanation}
                  disabled={submitting}
                  style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-[0.97] disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" /> Ver explicação
                </button>
              )}
            </div>
          </article>


          {showExplain && (
            <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-7">
              {explainLoading[q.id] && !explain && (
                <div className="space-y-3" aria-busy="true" aria-label="Carregando explicação">
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-9/12 animate-pulse rounded bg-muted" />
                  <div className="mt-4 h-20 w-full animate-pulse rounded-xl bg-muted" />
                  <div className="h-14 w-full animate-pulse rounded-xl bg-muted" />
                  <div className="h-14 w-full animate-pulse rounded-xl bg-muted" />
                </div>
              )}
              {!explainLoading[q.id] && !explain && explainError[q.id] && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-sm font-medium text-foreground">
                    Não foi possível carregar a explicação.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{explainError[q.id]}</p>
                  <button
                    type="button"
                    onClick={showExplanation}
                    style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                    className="mt-3 inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-[0.97]"
                  >
                    <RotateCcw className="h-4 w-4" /> Tentar novamente
                  </button>
                </div>
              )}
              {explain && (
                <>
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Resumo</h3>
                    <p className="mt-1.5 text-sm leading-relaxed">{explain.summary}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/8 p-4">
                    <h3 className="text-sm font-semibold">
                      Por que a alternativa {correctOpt?.label} está correta
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed">{explain.correct_rationale}</p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Alternativas erradas</h3>
                    {Object.entries(explain.wrong_rationales as Record<string, string>).map(([k, v]) => (
                      <div key={k} className="rounded-xl border border-border bg-background p-3.5 text-sm leading-relaxed">
                        <span className="font-semibold">{k})</span> {v}
                      </div>
                    ))}
                  </div>
                  {explain.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {explain.keywords.map((k) => (
                        <span key={k} className="rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground">
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Minhas anotações</h3>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => saveNoteFn({ data: { questionId: q.id, body: note } })}
                  placeholder="Anote pontos-chave..."
                  className="mt-2 min-h-24 w-full rounded-lg border border-input bg-background p-3 text-sm leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
            </section>
          )}

        </div>

        {/* NAVIGATION PANEL */}
        <aside className="order-first lg:order-last">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Navegação</h3>
            <div className="mt-3 grid grid-cols-8 gap-1.5 lg:grid-cols-5">
              {questions.map((qq, i) => {
                const st = states[qq.id];
                const active = i === idx;
                const cls = active
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                  : st?.submitted
                    ? st.isCorrect
                      ? "bg-[var(--color-success)]/15 text-[var(--color-success)] hover:bg-[var(--color-success)]/25"
                      : "bg-destructive/15 text-destructive hover:bg-destructive/25"
                    : "bg-accent text-muted-foreground hover:bg-accent/80";
                return (
                  <button
                    key={qq.id}
                    type="button"
                    onClick={() => goTo(i)}
                    style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                    className={`grid aspect-square min-h-10 place-items-center rounded-md text-xs font-medium transition active:scale-95 ${cls}`}
                  >
                    {i + 1}
                  </button>

                );
              })}
            </div>
            <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <Legend dot="bg-[var(--color-success)]" label="Acerto" />
              <Legend dot="bg-destructive" label="Erro" />
              <Legend dot="bg-accent border border-border" label="Não respondida" />
            </div>
          </div>
        </aside>
      </div>

      {confirmFinish && (
        <ConfirmModal
          unanswered={questions.filter((qq) => !states[qq.id]?.submitted).length}
          onCancel={() => setConfirmFinish(false)}
          onConfirm={() => {
            setConfirmFinish(false);
            setFinished(true);
          }}
          onJump={() => {
            const i = questions.findIndex((qq) => !states[qq.id]?.submitted);
            if (i >= 0) setIdx(i);
            setConfirmFinish(false);
          }}
        />
      )}
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-sm ${dot}`} />
      <span>{label}</span>
    </div>
  );
}

function ConfirmModal({
  unanswered, onCancel, onConfirm, onJump,
}: { unanswered: number; onCancel: () => void; onConfirm: () => void; onJump: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Você ainda tem questões em aberto</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Faltam {unanswered} {unanswered === 1 ? "questão" : "questões"} sem resposta. Você pode voltar para responder ou finalizar mesmo assim.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Cancelar
          </button>
          <button onClick={onJump} className="rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-accent">
            Ir para próxima em aberto
          </button>
          <button onClick={onConfirm} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Finalizar mesmo assim
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultsScreen({
  questions, states,
}: {
  questions: Array<{ id: string; subject: string | null }>;
  states: Record<string, AttemptState>;
}) {
  const answered = questions.filter((q) => states[q.id]?.submitted);
  const correct = answered.filter((q) => states[q.id]?.isCorrect).length;
  const total = questions.length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const grade = (correct / Math.max(total, 1)) * 10;

  // by subject
  const map = new Map<string, { total: number; correct: number }>();
  for (const q of answered) {
    const k = q.subject ?? "Outros";
    const cur = map.get(k) ?? { total: 0, correct: 0 };
    cur.total++;
    if (states[q.id]?.isCorrect) cur.correct++;
    map.set(k, cur);
  }
  const subjects = Array.from(map.entries()).map(([s, v]) => ({
    subject: s,
    accuracy: v.total ? Math.round((v.correct / v.total) * 100) : 0,
    total: v.total,
  }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Trophy className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">Sessão concluída</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bom trabalho. Cada questão errada é um passo a mais para a aprovação.
        </p>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        <BigStat label="Aproveitamento" value={`${pct}%`} />
        <BigStat label="Acertos" value={`${correct} de ${total}`} />
        <BigStat label="Nota" value={grade.toFixed(1).replace(".", ",")} />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Resumo</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" /> {correct} acertos</li>
            <li className="flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" /> {answered.length - correct} erros</li>
            <li className="flex items-center gap-2 text-muted-foreground">— {total - answered.length} em branco</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Por matéria</h3>
          {subjects.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {subjects.map((s) => (
                <li key={s.subject}>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{s.subject}</span>
                    <span>{s.accuracy}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full bg-primary" style={{ width: `${s.accuracy}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/practice"
          search={{ wrong: true } as never}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <RotateCcw className="h-4 w-4" /> Revisar apenas erradas
        </Link>
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent"
        >
          Voltar ao dashboard
        </Link>
      </div>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-center">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
