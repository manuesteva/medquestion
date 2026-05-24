import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listUploadsWithStats,
  renameUpload,
  deleteUpload,
} from "@/lib/practice.functions";
import { toast } from "sonner";
import {
  Library as LibraryIcon,
  Pencil,
  Trash2,
  Play,
  Upload as UploadIcon,
  Shuffle,
  CheckCircle2,
  Clock,
  Target,
  FileText,
  Loader2,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/library")({ component: LibraryPage });

type Row = Awaited<ReturnType<typeof listUploadsWithStats>>[number];

function LibraryPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fn = useServerFn(listUploadsWithStats);
  const renameFn = useServerFn(renameUpload);
  const delFn = useServerFn(deleteUpload);

  const { data, isLoading } = useQuery({ queryKey: ["library"], queryFn: () => fn() });
  const rows: Row[] = data ?? [];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<Row | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [savingRename, setSavingRename] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const doneRows = useMemo(() => rows.filter((r) => r.status === "done"), [rows]);
  const allSelected = doneRows.length > 0 && doneRows.every((r) => selected.has(r.id));

  function startSession(ids: string[]) {
    if (ids.length === 0) return;
    navigate({
      to: "/practice",
      search: { uploadIds: ids.join(",") } as never,
    });
  }

  async function confirmRename() {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) return;
    setSavingRename(true);
    try {
      await renameFn({ data: { uploadId: renaming.id, name } });
      toast.success("Nome atualizado");
      setRenaming(null);
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["uploads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingRename(false);
    }
  }

  async function performDelete() {
    if (!deleting) return;
    try {
      await delFn({ data: { uploadId: deleting.id } });
      toast.success("Prova excluída");
      setDeleting(null);
      setConfirmDelete(false);
      setSelected((s) => {
        const n = new Set(s);
        n.delete(deleting.id);
        return n;
      });
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["questions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[11px] font-medium text-accent-foreground">
            <LibraryIcon className="h-3.5 w-3.5" /> Biblioteca
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Minhas provas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie, renomeie, exclua e selecione provas para sessões de estudo.
          </p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <UploadIcon className="h-4 w-4" /> Nova prova
        </Link>
      </div>

      {/* Selection toolbar */}
      {doneRows.length > 0 && (
        <div className="sticky top-0 z-20 mt-6 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={() => {
                if (allSelected) setSelected(new Set());
                else setSelected(new Set(doneRows.map((r) => r.id)));
              }}
              className="rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-accent"
            >
              {allSelected ? "Limpar" : "Selecionar todas"}
            </button>
            <span className="text-xs text-muted-foreground">
              {selected.size} de {doneRows.length} selecionada(s)
            </span>
          </div>
          <button
            onClick={() => startSession(Array.from(selected))}
            disabled={selected.size === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            <Shuffle className="h-4 w-4" />
            {selected.size > 1 ? "Misturar selecionadas" : "Estudar selecionada"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="mt-12 grid place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <h2 className="text-lg font-semibold">Sua biblioteca está vazia</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Envie sua primeira prova para começar a estudar.
          </p>
          <Link
            to="/upload"
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <UploadIcon className="h-4 w-4" /> Enviar prova
          </Link>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {rows.map((u) => (
            <ExamCard
              key={u.id}
              row={u}
              selected={selected.has(u.id)}
              onToggle={() => toggle(u.id)}
              onPlay={() => startSession([u.id])}
              onRename={() => {
                setRenaming(u);
                setRenameValue(u.display_name || u.file_name);
              }}
              onDelete={() => {
                setDeleting(u);
                setConfirmDelete(false);
              }}
            />
          ))}
        </div>
      )}

      {/* Rename modal */}
      {renaming && (
        <Modal onClose={() => setRenaming(null)} title="Renomear prova">
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={120}
            className="mt-2 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setRenaming(null)}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={confirmRename}
              disabled={savingRename || !renameValue.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {savingRename && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar
            </button>
          </div>
        </Modal>
      )}

      {/* Delete confirm modal */}
      {deleting && (
        <Modal onClose={() => setDeleting(null)} title="Excluir prova?">
          <p className="mt-1 text-sm text-muted-foreground">
            Tem certeza que deseja excluir{" "}
            <span className="font-medium text-foreground">
              “{deleting.display_name || deleting.file_name}”
            </span>
            ? Todas as questões, tentativas, favoritos e estatísticas relacionadas serão removidas.
            Esta ação não pode ser desfeita.
          </p>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Entendo e desejo excluir esta prova
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setDeleting(null)}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={performDelete}
              disabled={!confirmDelete}
              className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir definitivamente
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ExamCard({
  row,
  selected,
  onToggle,
  onPlay,
  onRename,
  onDelete,
}: {
  row: Row;
  selected: boolean;
  onToggle: () => void;
  onPlay: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const isDone = row.status === "done";
  const isFailed = row.status === "failed";
  const date = new Date(row.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const lastStudied = row.lastStudiedAt
    ? new Date(row.lastStudiedAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })
    : null;

  return (
    <div
      className={`group relative flex flex-col gap-4 rounded-2xl border bg-card p-5 transition ${
        selected ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-foreground/20"
      }`}
    >
      {isDone && (
        <button
          onClick={onToggle}
          aria-label="Selecionar"
          className={`absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-md border transition ${
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background hover:border-foreground/30"
          }`}
        >
          {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
        </button>
      )}

      <div className="flex items-start gap-3 pr-8">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            isFailed
              ? "bg-destructive/10 text-destructive"
              : isDone
                ? "bg-primary/10 text-primary"
                : "bg-accent text-muted-foreground"
          }`}
        >
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">
            {row.display_name || row.file_name}
          </div>
          {row.display_name && (
            <div className="truncate text-xs text-muted-foreground">{row.file_name}</div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{date}</span>
            {isDone && (
              <>
                <span>· {row.questions_count} questões</span>
                {lastStudied && <span>· Último estudo {lastStudied}</span>}
              </>
            )}
            {row.status === "processing" && <span className="text-primary">· Processando…</span>}
            {isFailed && <span className="text-destructive">· Falhou</span>}
          </div>
        </div>
      </div>

      {isDone && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Mini icon={Target} label="Acerto" value={`${row.accuracy}%`} />
            <Mini icon={Clock} label="Progresso" value={`${row.progress}%`} />
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${row.progress}%` }}
            />
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {isDone && (
          <button
            onClick={onPlay}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Play className="h-3.5 w-3.5" /> Estudar
          </button>
        )}
        <button
          onClick={onRename}
          aria-label="Renomear"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          aria-label="Excluir"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Mini({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-accent/50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
