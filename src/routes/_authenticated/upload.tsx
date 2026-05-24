import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { extractQuestions, extractQuestionsFromText } from "@/lib/extract.functions";
import { listUploads } from "@/lib/practice.functions";
import { toast } from "sonner";
import {
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Library,
  Type,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/upload")({ component: UploadPage });

const PHASES = [
  "Lendo o conteúdo…",
  "Identificando questões…",
  "Extraindo enunciados…",
  "Organizando alternativas…",
  "Revisando texto…",
  "Salvando no seu banco…",
];

type Mode = "file" | "text";

function UploadPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const extract = useServerFn(extractQuestions);
  const extractText = useServerFn(extractQuestionsFromText);
  const list = useServerFn(listUploads);
  const uploads = useQuery({ queryKey: ["uploads"], queryFn: () => list(), refetchInterval: 4000 });
  const [mode, setMode] = useState<Mode>("file");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [examName, setExamName] = useState("");
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!busy) return;
    setPhase(0);
    const t = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 1800);
    return () => clearInterval(t);
  }, [busy]);

  async function handleFile(file: File) {
    if (!user) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 25MB).");
      return;
    }
    const okType = ["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type);
    if (!okType) {
      toast.error("Use PDF, PNG, JPG ou WEBP.");
      return;
    }
    setBusy(true);
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const trimmedName = examName.trim();
    try {
      const up = await supabase.storage
        .from("prova-uploads")
        .upload(path, file, { contentType: file.type });
      if (up.error) throw new Error(up.error.message);

      const { data: row, error: insErr } = await supabase
        .from("uploads")
        .insert({
          user_id: user.id,
          file_name: file.name,
          display_name: trimmedName || null,
          file_path: path,
          mime_type: file.type,
          status: "processing",
        })
        .select("id")
        .single();
      if (insErr || !row) throw new Error(insErr?.message ?? "Falha ao registrar");

      qc.invalidateQueries({ queryKey: ["uploads"] });
      const result = await extract({
        data: { uploadId: row.id, filePath: path, mimeType: file.type },
      });
      toast.success(`${result.count} questão(ões) extraída(s)!`);
      setExamName("");
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleText() {
    if (!text.trim()) {
      toast.error("Cole ou digite um texto primeiro.");
      return;
    }
    setBusy(true);
    try {
      const result = await extractText({
        data: { text: text.trim(), displayName: examName.trim() || null },
      });
      toast.success(`${result.count} questão(ões) processada(s)!`);
      setText("");
      setExamName("");
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar texto");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Enviar prova</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Envie um PDF, imagem ou cole o texto. A IA extrai as questões automaticamente.
      </p>

      {/* Mode tabs */}
      <div className="mt-6 inline-flex rounded-full border border-border bg-secondary p-1">
        <button
          onClick={() => setMode("file")}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            mode === "file" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <UploadCloud className="h-4 w-4" /> PDF / Imagem
        </button>
        <button
          onClick={() => setMode("text")}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            mode === "text" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Type className="h-4 w-4" /> Texto
        </button>
      </div>

      <div className="mt-5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="exam-name">
          Nome da prova (opcional)
        </label>
        <input
          id="exam-name"
          value={examName}
          onChange={(e) => setExamName(e.target.value)}
          placeholder="Ex.: SUS SP 2024, AMRIGS Clínica…"
          maxLength={120}
          disabled={busy}
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>

      {mode === "file" ? (
        <label
          className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
            busy ? "opacity-90" : "border-border hover:border-primary hover:bg-accent/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          {busy ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="mt-4 font-medium">Processando com IA</p>
              <p
                key={phase}
                className="mt-1 animate-in fade-in slide-in-from-bottom-1 text-sm text-muted-foreground"
              >
                {PHASES[phase]}
              </p>
              <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-border">
                <div className="h-full w-1/3 animate-pulse bg-primary" />
              </div>
            </>
          ) : (
            <>
              <UploadCloud className="h-10 w-10 text-primary" />
              <p className="mt-4 font-medium">Clique para enviar ou arraste o arquivo</p>
              <p className="mt-1 text-sm text-muted-foreground">PDF, PNG, JPG ou WEBP · até 25MB</p>
            </>
          )}
        </label>
      ) : (
        <div className="mt-5 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            rows={14}
            placeholder="Cole ou digite aqui suas questões…&#10;&#10;Ex.:&#10;1. Qual é o tratamento de primeira linha para...?&#10;A) Opção A&#10;B) Opção B&#10;C) Opção C&#10;D) Opção D&#10;Gabarito: B"
            className="w-full resize-y rounded-2xl border border-input bg-background p-4 font-mono text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {text.length.toLocaleString("pt-BR")} caracteres
              {text.length > 0 && " · a IA reconhece alternativas (A–E) e numeração"}
            </p>
            <button
              onClick={handleText}
              disabled={busy || !text.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {PHASES[phase]}
                </>
              ) : (
                <>
                  Processar texto <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Uploads recentes</h2>
        <Link
          to="/library"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Library className="h-3.5 w-3.5" /> Ver biblioteca
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {(uploads.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum upload ainda.</p>
        )}
        {(uploads.data ?? []).map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{u.display_name || u.file_name}</div>
              <div className="text-xs text-muted-foreground">
                {u.status === "done"
                  ? `${u.questions_count} questão(ões) extraída(s)`
                  : u.status === "failed"
                    ? (u.error ?? "Falhou")
                    : "Processando…"}
              </div>
            </div>
            {u.status === "done" && (
              <CheckCircle2 className="h-5 w-5 text-[var(--color-success)]" />
            )}
            {u.status === "failed" && <XCircle className="h-5 w-5 text-destructive" />}
            {u.status === "processing" && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      <Link
        to="/practice"
        className="mt-8 inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Começar a estudar <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
