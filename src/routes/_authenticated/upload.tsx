import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  extractQuestions,
  extractQuestionsFromText,
  createUploadShell,
  createSignedUploadUrl,
} from "@/lib/extract.functions";
import { listUploads } from "@/lib/practice.functions";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  X,
  AlertTriangle,
  GripVertical,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/upload")({ component: UploadPage });

type Mode = "file" | "text";

type QueueItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "uploading" | "uploaded" | "error";
  progress: number; // 0-100
  path?: string;
  error?: string;
};

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";
const MAX_SIZE = 25 * 1024 * 1024;
const MAX_FILES = 30;

const PROCESSING_MESSAGES = [
  "Analisando as páginas…",
  "Identificando as questões…",
  "Reconhecendo o texto com OCR…",
  "Corrigindo erros de português…",
  "Validando as alternativas…",
  "Cruzando gabarito com explicação…",
  "Validando a sequência das questões…",
  "Salvando no seu banco…",
];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Compress large images via canvas (max 2000px on longest side).
async function maybeCompress(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= 2 * 1024 * 1024) return file;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("img load"));
      el.src = url;
    });
    const max = 2000;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    if (scale === 1) {
      URL.revokeObjectURL(url);
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    URL.revokeObjectURL(url);
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

function UploadPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const extract = useServerFn(extractQuestions);
  const extractText = useServerFn(extractQuestionsFromText);
  const createShell = useServerFn(createUploadShell);
  const createSignedUrl = useServerFn(createSignedUploadUrl);
  const list = useServerFn(listUploads);

  const uploads = useQuery({
    queryKey: ["uploads"],
    queryFn: () => list(),
    refetchInterval: 4000,
  });

  const [mode, setMode] = useState<Mode>("file");
  const [examName, setExamName] = useState("");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"upload" | "ai" | null>(null);
  const [phaseMsg, setPhaseMsg] = useState(0);
  const [aiSeconds, setAiSeconds] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI phase ticker (timer + rotating messages)
  useEffect(() => {
    if (phase !== "ai") return;
    setAiSeconds(0);
    setPhaseMsg(0);
    const t1 = setInterval(() => setAiSeconds((s) => s + 1), 1000);
    const t2 = setInterval(
      () => setPhaseMsg((p) => (p + 1) % PROCESSING_MESSAGES.length),
      2200,
    );
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [phase]);

  function addFiles(filesIn: FileList | File[]) {
    const arr = Array.from(filesIn);
    const valid: File[] = [];
    for (const f of arr) {
      const okType = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
      ].includes(f.type);
      if (!okType) {
        toast.error(`Tipo não suportado: ${f.name}`);
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast.error(`Arquivo muito grande (máx 25MB): ${f.name}`);
        continue;
      }
      valid.push(f);
    }
    setItems((prev) => {
      const next = [...prev];
      for (const f of valid) {
        if (next.length >= MAX_FILES) {
          toast.error(`Máximo de ${MAX_FILES} arquivos por prova.`);
          break;
        }
        next.push({
          id: uid(),
          file: f,
          previewUrl: URL.createObjectURL(f),
          status: "queued",
          progress: 0,
        });
      }
      return next;
    });
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function clearAll() {
    items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    setItems([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((p) => p.id === active.id);
      const newIdx = prev.findIndex((p) => p.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  async function uploadOne(
    item: QueueItem,
    path: string,
  ): Promise<void> {
    const compressed = await maybeCompress(item.file);
    const sig = await createSignedUrl({ data: { path } });
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", sig.signedUrl, true);
      xhr.setRequestHeader("Content-Type", compressed.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setItems((prev) =>
            prev.map((p) =>
              p.id === item.id ? { ...p, progress: pct } : p,
            ),
          );
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setItems((prev) =>
            prev.map((p) =>
              p.id === item.id
                ? { ...p, status: "uploaded", progress: 100, path }
                : p,
            ),
          );
          resolve();
        } else {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Erro de rede"));
      xhr.send(compressed);
    });
  }

  async function handleProcess() {
    if (!user || items.length === 0) return;
    setBusy(true);
    setPhase("upload");

    const baseStamp = Date.now();
    const trimmedName = examName.trim();

    try {
      // 1) Reserve all paths.
      const withPaths = items.map((it, i) => ({
        item: it,
        path: `${user.id}/${baseStamp}-${i.toString().padStart(2, "0")}-${it.file.name.replace(/[^\w.-]/g, "_")}`,
      }));

      // 2) Create the upload shell with the first file's metadata.
      const first = withPaths[0];
      const shell = await createShell({
        data: {
          fileName: items.length === 1 ? first.item.file.name : `${trimmedName || "Prova"} (${items.length} páginas)`,
          displayName: trimmedName || null,
          firstFilePath: first.path,
          mimeType: first.item.file.type,
        },
      });
      qc.invalidateQueries({ queryKey: ["uploads"] });

      // 3) Upload sequentially (keeps the bar honest + avoids saturating uplink).
      setItems((prev) =>
        prev.map((p) => ({ ...p, status: "uploading", progress: 0 })),
      );
      for (const wp of withPaths) {
        try {
          await uploadOne(wp.item, wp.path);
        } catch (e) {
          setItems((prev) =>
            prev.map((p) =>
              p.id === wp.item.id
                ? { ...p, status: "error", error: e instanceof Error ? e.message : "Falha" }
                : p,
            ),
          );
          throw e;
        }
      }

      // 4) Call extract with the full list.
      setPhase("ai");
      const result = await extract({
        data: {
          uploadId: shell.uploadId,
          files: withPaths.map((wp) => ({
            path: wp.path,
            mimeType: wp.item.file.type,
          })),
        },
      });

      toast.success(`${result.count} questão(ões) extraída(s)!`);
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach((w) => toast.warning(w, { duration: 7000 }));
      }
      clearAll();
      setExamName("");
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio");
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }

  async function handleText() {
    if (!text.trim()) {
      toast.error("Cole ou digite um texto primeiro.");
      return;
    }
    setBusy(true);
    setPhase("ai");
    try {
      const result = await extractText({
        data: { text: text.trim(), displayName: examName.trim() || null },
      });
      toast.success(`${result.count} questão(ões) processada(s)!`);
      if ("warnings" in result && Array.isArray(result.warnings)) {
        result.warnings.forEach((w: string) => toast.warning(w, { duration: 7000 }));
      }
      setText("");
      setExamName("");
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar texto");
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }

  const totalProgress =
    items.length > 0
      ? Math.round(items.reduce((sum, p) => sum + p.progress, 0) / items.length)
      : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Enviar prova</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Envie um PDF, várias imagens ou cole o texto. A IA agrupa tudo em uma única prova.
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
          <UploadCloud className="h-4 w-4" /> Arquivos
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
        <div className="mt-5 space-y-4">
          {/* Dropzone */}
          <label
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (busy) return;
              if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-10 ${
              busy ? "pointer-events-none opacity-60" : "border-border hover:border-primary hover:bg-accent/40"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              accept={ACCEPT}
              disabled={busy}
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <UploadCloud className="h-10 w-10 text-primary" />
            <p className="mt-4 font-medium">
              {items.length === 0
                ? "Clique para enviar ou arraste seus arquivos"
                : "Adicionar mais arquivos"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, PNG, JPG ou WEBP · até 25MB por arquivo · até {MAX_FILES} páginas
            </p>
          </label>

          {/* Queue grid */}
          {items.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {items.length} {items.length === 1 ? "página" : "páginas"} ·
                  <span className="ml-1 text-muted-foreground">
                    Arraste para reordenar
                  </span>
                </p>
                <button
                  onClick={clearAll}
                  disabled={busy}
                  className="text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  Limpar tudo
                </button>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={items.map((i) => i.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {items.map((it, idx) => (
                      <SortableThumb
                        key={it.id}
                        item={it}
                        index={idx + 1}
                        onRemove={() => removeItem(it.id)}
                        disabled={busy}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Aggregate upload progress */}
              {phase === "upload" && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Enviando arquivos…</span>
                    <span className="tabular-nums text-muted-foreground">
                      {totalProgress}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-200"
                      style={{ width: `${totalProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* AI processing */}
              {phase === "ai" && (
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando com IA · {aiSeconds}s
                  </div>
                  <p
                    key={phaseMsg}
                    className="mt-1 animate-in fade-in slide-in-from-bottom-1 text-xs text-muted-foreground"
                  >
                    {PROCESSING_MESSAGES[phaseMsg]}
                  </p>
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full w-1/3 animate-pulse bg-primary" />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Pode levar até 1–2 minutos para provas longas. Não feche esta página.
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Todas as páginas serão agrupadas em <strong className="text-foreground">uma única prova</strong>.
                </p>
                <button
                  onClick={handleProcess}
                  disabled={busy || items.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Processar {items.length} {items.length === 1 ? "página" : "páginas"}
                </button>
              </div>
            </div>
          )}
        </div>
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
          {phase === "ai" && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
              <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />
              {PROCESSING_MESSAGES[phaseMsg]} ({aiSeconds}s)
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {text.length.toLocaleString("pt-BR")} caracteres
            </p>
            <button
              onClick={handleText}
              disabled={busy || !text.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Processar texto <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Recent uploads */}
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
        {(uploads.data ?? []).map((u) => {
          const warnsRaw = (u as unknown as { warnings?: unknown }).warnings;
          const warns: string[] = Array.isArray(warnsRaw)
            ? (warnsRaw as string[])
            : [];
          return (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {u.display_name || u.file_name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {u.status === "done"
                    ? `${u.questions_count} questão(ões) extraída(s)`
                    : u.status === "failed"
                      ? (u.error ?? "Falhou")
                      : "Processando…"}
                </div>
                {warns.length > 0 && (
                  <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{warns[0]}{warns.length > 1 ? ` (+${warns.length - 1})` : ""}</span>
                  </div>
                )}
              </div>
              {u.status === "done" && (
                <CheckCircle2 className="h-5 w-5 text-[var(--color-success)]" />
              )}
              {u.status === "failed" && <XCircle className="h-5 w-5 text-destructive" />}
              {u.status === "processing" && (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>
          );
        })}
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

// =========================================================================
// Sortable thumbnail
// =========================================================================
function SortableThumb({
  item,
  index,
  onRemove,
  disabled,
}: {
  item: QueueItem;
  index: number;
  onRemove: () => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const isImg = item.file.type.startsWith("image/");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative overflow-hidden rounded-lg border border-border bg-background"
    >
      <div className="absolute left-1 top-1 z-10 grid h-5 w-5 place-items-center rounded bg-foreground/70 text-[10px] font-bold text-background">
        {index}
      </div>
      <button
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remover"
        className="absolute right-1 top-1 z-10 grid h-6 w-6 place-items-center rounded bg-foreground/70 text-background opacity-0 transition group-hover:opacity-100 disabled:opacity-0"
      >
        <X className="h-3 w-3" />
      </button>
      <button
        {...attributes}
        {...listeners}
        type="button"
        disabled={disabled}
        aria-label="Reordenar"
        className="absolute bottom-1 right-1 z-10 grid h-6 w-6 cursor-grab place-items-center rounded bg-foreground/70 text-background opacity-0 transition group-hover:opacity-100 active:cursor-grabbing disabled:opacity-0"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <div className="aspect-[3/4] w-full bg-muted">
        {isImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.previewUrl}
            alt={item.file.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <FileText className="h-6 w-6" />
            <span className="px-2 text-[10px]">PDF</span>
          </div>
        )}
      </div>
      <div className="border-t border-border bg-card px-2 py-1.5">
        <p className="truncate text-[11px]">{item.file.name}</p>
        {item.status === "uploading" && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-150"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}
        {item.status === "uploaded" && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[var(--color-success)]">
            <CheckCircle2 className="h-2.5 w-2.5" /> Enviado
          </p>
        )}
        {item.status === "error" && (
          <p className="mt-0.5 truncate text-[10px] text-destructive">
            {item.error ?? "Erro"}
          </p>
        )}
      </div>
    </div>
  );
}