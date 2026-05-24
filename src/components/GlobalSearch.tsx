import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { globalSearch } from "@/lib/search.functions";
import { Search, FileText, Brain, StickyNote, X, Loader2, Clock } from "lucide-react";

const HISTORY_KEY = "global-search:history";

function loadHistory(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const v = localStorage.getItem(HISTORY_KEY);
    return v ? JSON.parse(v) : [];
  } catch {
    return [];
  }
}
function saveHistory(items: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 5)));
  } catch {
    /* ignore */
  }
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [results, setResults] = useState<Awaited<ReturnType<typeof search>> | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const search = useServerFn(globalSearch);
  const nav = useNavigate();

  // Keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setHistory(loadHistory());
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQ("");
      setResults(null);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await search({ data: { query: term } });
        setResults(r);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, search]);

  function commitSearch(term: string) {
    const next = [term, ...history.filter((h) => h !== term)].slice(0, 5);
    setHistory(next);
    saveHistory(next);
  }

  function go(to: string, search?: Record<string, string>) {
    if (q.trim().length >= 2) commitSearch(q.trim());
    setOpen(false);
    nav({ to, search: search as never });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground transition active:scale-95 hover:bg-accent"
      >
        <Search className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-foreground/30 p-4 pt-[10vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar provas, questões, matérias, notas..."
                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {!results && q.trim().length < 2 && history.length > 0 && (
                <div>
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recentes
                  </div>
                  {history.map((h) => (
                    <button
                      key={h}
                      onClick={() => setQ(h)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {h}
                    </button>
                  ))}
                </div>
              )}

              {!results && q.trim().length < 2 && history.length === 0 && (
                <div className="grid place-items-center p-10 text-center text-xs text-muted-foreground">
                  Digite ao menos 2 caracteres
                </div>
              )}

              {results && (
                <div>
                  {results.uploads.length === 0 &&
                    results.questions.length === 0 &&
                    results.notes.length === 0 && (
                      <div className="grid place-items-center p-10 text-center text-sm text-muted-foreground">
                        Nada encontrado para “{q}”
                      </div>
                    )}

                  {results.uploads.length > 0 && (
                    <Section title="Provas">
                      {results.uploads.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => go("/library")}
                          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent"
                        >
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="truncate text-sm">{u.display_name || u.file_name}</span>
                        </button>
                      ))}
                    </Section>
                  )}

                  {results.questions.length > 0 && (
                    <Section title="Questões">
                      {results.questions.map((qq) => (
                        <button
                          key={qq.id}
                          onClick={() => go("/practice", qq.upload_id ? { uploadIds: qq.upload_id } : {})}
                          className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent"
                        >
                          <Brain className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <div className="line-clamp-2 text-sm">{qq.statement}</div>
                            {qq.subject && (
                              <div className="mt-0.5 text-[11px] text-muted-foreground">{qq.subject}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </Section>
                  )}

                  {results.notes.length > 0 && (
                    <Section title="Notas">
                      {results.notes.map((n) => (
                        <button
                          key={n.question_id}
                          onClick={() => go("/practice")}
                          className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent"
                        >
                          <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span className="line-clamp-2 text-sm">{n.body}</span>
                        </button>
                      ))}
                    </Section>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
              <span>⌘K para abrir · Esc para fechar</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}
