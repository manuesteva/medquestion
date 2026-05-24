import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listUploadsWithStats,
  renameUpload,
  deleteUpload,
} from "@/lib/practice.functions";
import {
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  moveUploadToFolder,
} from "@/lib/folders.functions";
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
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Search,
  FolderInput,
  Inbox,
  Layers,
  Menu,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/library")({ component: LibraryPage });

type Row = Awaited<ReturnType<typeof listUploadsWithStats>>[number];
type FolderRow = Awaited<ReturnType<typeof listFolders>>["folders"][number];

const COLORS = ["blue", "violet", "emerald", "amber", "rose", "slate"] as const;
type ColorKey = (typeof COLORS)[number];

const COLOR_DOT: Record<ColorKey, string> = {
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

type ActiveFolder = "all" | "unfiled" | string;

function LibraryPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listUploadsWithStats);
  const renameFn = useServerFn(renameUpload);
  const delFn = useServerFn(deleteUpload);
  const foldersFn = useServerFn(listFolders);
  const moveFn = useServerFn(moveUploadToFolder);

  const uploadsQ = useQuery({ queryKey: ["library"], queryFn: () => listFn() });
  const foldersQ = useQuery({ queryKey: ["folders"], queryFn: () => foldersFn() });

  const rows: Row[] = uploadsQ.data ?? [];
  const folders: FolderRow[] = foldersQ.data?.folders ?? [];
  const unfiledCount = foldersQ.data?.unfiledCount ?? 0;
  const totalCount = foldersQ.data?.totalCount ?? rows.length;

  const [active, setActive] = useState<ActiveFolder>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<Row | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [savingRename, setSavingRename] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [folderDialog, setFolderDialog] = useState<
    | { mode: "create" }
    | { mode: "edit"; folder: FolderRow }
    | null
  >(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderRow | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const filteredRows = useMemo(() => {
    let r = rows;
    if (active === "unfiled") r = r.filter((u) => !u.folder_id);
    else if (active !== "all") r = r.filter((u) => u.folder_id === active);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      r = r.filter((u) =>
        (u.display_name || "").toLowerCase().includes(q) ||
        u.file_name.toLowerCase().includes(q),
      );
    }
    return r;
  }, [rows, active, query]);

  const doneRows = useMemo(() => filteredRows.filter((r) => r.status === "done"), [filteredRows]);
  const allSelected = doneRows.length > 0 && doneRows.every((r) => selected.has(r.id));

  function startSession(ids: string[]) {
    if (ids.length === 0) return;
    navigate({ to: "/practice", search: { uploadIds: ids.join(",") } as never });
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
      qc.invalidateQueries({ queryKey: ["folders"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["questions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  async function handleMove(uploadId: string, folderId: string | null) {
    try {
      await moveFn({ data: { uploadId, folderId } });
      toast.success(folderId ? "Movida para a pasta" : "Removida da pasta");
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["folders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao mover");
    }
  }

  const sidebar = (
    <FoldersSidebar
      active={active}
      onSelect={(v) => {
        setActive(v);
        setMobileSidebarOpen(false);
      }}
      folders={folders}
      totalCount={totalCount}
      unfiledCount={unfiledCount}
      loading={foldersQ.isLoading}
      onCreate={() => setFolderDialog({ mode: "create" })}
      onEdit={(f) => setFolderDialog({ mode: "edit", folder: f })}
      onDelete={(f) => setFolderToDelete(f)}
    />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[11px] font-medium text-accent-foreground">
            <LibraryIcon className="h-3.5 w-3.5" /> Biblioteca
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Minhas provas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize por pastas, renomeie, exclua e selecione provas para estudar.
          </p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <UploadIcon className="h-4 w-4" /> Nova prova
        </Link>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[15rem_1fr]">
        {/* Sidebar — desktop */}
        <aside className="hidden md:block">{sidebar}</aside>

        {/* Right column */}
        <div className="min-w-0">
          {/* Search + mobile sidebar toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm md:hidden"
            >
              <Menu className="h-4 w-4" /> Pastas
            </button>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar provas…"
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </div>

          {/* Selection toolbar */}
          {doneRows.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-3 text-sm">
                <button
                  onClick={() => {
                    if (allSelected) setSelected(new Set());
                    else setSelected(new Set(doneRows.map((r) => r.id)));
                  }}
                  className="rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-accent"
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

          {uploadsQ.isLoading ? (
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
          ) : filteredRows.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              Nenhuma prova encontrada nesta visão.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {filteredRows.map((u) => (
                <ExamCard
                  key={u.id}
                  row={u}
                  folders={folders}
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
                  onMove={(folderId) => handleMove(u.id, folderId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile sidebar sheet */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div
            className="absolute left-0 top-0 h-full w-72 border-r border-border bg-background p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Pastas</h2>
              <button onClick={() => setMobileSidebarOpen(false)} aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}

      {/* Rename upload modal */}
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

      {/* Delete upload confirm */}
      {deleting && (
        <Modal onClose={() => setDeleting(null)} title="Excluir prova?">
          <p className="mt-1 text-sm text-muted-foreground">
            Tem certeza que deseja excluir{" "}
            <span className="font-medium text-foreground">
              "{deleting.display_name || deleting.file_name}"
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

      {/* Folder create / edit dialog */}
      {folderDialog && (
        <FolderDialog
          mode={folderDialog.mode}
          initial={folderDialog.mode === "edit" ? folderDialog.folder : undefined}
          onClose={() => setFolderDialog(null)}
          onSaved={() => {
            setFolderDialog(null);
            qc.invalidateQueries({ queryKey: ["folders"] });
          }}
        />
      )}

      {/* Folder delete confirm */}
      {folderToDelete && (
        <Modal onClose={() => setFolderToDelete(null)} title="Excluir pasta?">
          <p className="mt-1 text-sm text-muted-foreground">
            A pasta{" "}
            <span className="font-medium text-foreground">"{folderToDelete.name}"</span> será
            removida. As provas dentro dela vão para <span className="font-medium text-foreground">"Sem pasta"</span> — nenhuma prova será excluída.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setFolderToDelete(null)}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <DeleteFolderButton
              folder={folderToDelete}
              onDone={() => {
                setFolderToDelete(null);
                if (active === folderToDelete.id) setActive("all");
                qc.invalidateQueries({ queryKey: ["folders"] });
                qc.invalidateQueries({ queryKey: ["library"] });
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

function FoldersSidebar({
  active,
  onSelect,
  folders,
  totalCount,
  unfiledCount,
  loading,
  onCreate,
  onEdit,
  onDelete,
}: {
  active: ActiveFolder;
  onSelect: (v: ActiveFolder) => void;
  folders: FolderRow[];
  totalCount: number;
  unfiledCount: number;
  loading: boolean;
  onCreate: () => void;
  onEdit: (f: FolderRow) => void;
  onDelete: (f: FolderRow) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <SidebarItem
        icon={Layers}
        label="Todas as provas"
        count={totalCount}
        active={active === "all"}
        onClick={() => onSelect("all")}
      />
      <SidebarItem
        icon={Inbox}
        label="Sem pasta"
        count={unfiledCount}
        active={active === "unfiled"}
        onClick={() => onSelect("unfiled")}
      />

      <div className="mt-5 flex items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Pastas</span>
        <button
          onClick={onCreate}
          aria-label="Nova pasta"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-1 flex flex-col gap-0.5">
        {loading ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Carregando…</div>
        ) : folders.length === 0 ? (
          <button
            onClick={onCreate}
            className="rounded-lg border border-dashed border-border px-2.5 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            + Criar primeira pasta
          </button>
        ) : (
          folders.map((f) => (
            <FolderItem
              key={f.id}
              folder={f}
              active={active === f.id}
              onClick={() => onSelect(f.id)}
              onEdit={() => onEdit(f)}
              onDelete={() => onDelete(f)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition ${
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="text-[11px] tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}

function FolderItem({
  folder,
  active,
  onClick,
  onEdit,
  onDelete,
}: {
  folder: FolderRow;
  active: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const color = (folder.color ?? "blue") as ColorKey;

  return (
    <div ref={ref} className="group relative">
      <button
        onClick={onClick}
        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition ${
          active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        }`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR_DOT[color] ?? COLOR_DOT.blue}`} />
        {active ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
        <span className="flex-1 truncate text-left">{folder.name}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">{folder.count}</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        aria-label="Ações"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-background"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <button
            onClick={() => {
              setMenuOpen(false);
              onEdit();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent"
          >
            <Pencil className="h-3.5 w-3.5" /> Renomear / cor
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}

function ExamCard({
  row,
  folders,
  selected,
  onToggle,
  onPlay,
  onRename,
  onDelete,
  onMove,
}: {
  row: Row;
  folders: FolderRow[];
  selected: boolean;
  onToggle: () => void;
  onPlay: () => void;
  onRename: () => void;
  onDelete: () => void;
  onMove: (folderId: string | null) => void;
}) {
  const isDone = row.status === "done";
  const isFailed = row.status === "failed";
  const date = new Date(row.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const lastStudied = row.lastStudiedAt
    ? new Date(row.lastStudiedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
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
            <div className="h-full bg-primary transition-all" style={{ width: `${row.progress}%` }} />
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
        <MoveToFolderMenu
          currentFolderId={row.folder_id ?? null}
          folders={folders}
          onMove={onMove}
        />
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

function MoveToFolderMenu({
  currentFolderId,
  folders,
  onMove,
}: {
  currentFolderId: string | null;
  folders: FolderRow[];
  onMove: (folderId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Mover para pasta"
        title="Mover para pasta"
        className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <FolderInput className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <div className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mover para…
          </div>
          <div className="max-h-64 overflow-y-auto">
            <button
              onClick={() => {
                setOpen(false);
                onMove(null);
              }}
              disabled={currentFolderId === null}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent disabled:opacity-40"
            >
              <Inbox className="h-3.5 w-3.5" /> Sem pasta
            </button>
            {folders.map((f) => {
              const color = (f.color ?? "blue") as ColorKey;
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setOpen(false);
                    onMove(f.id);
                  }}
                  disabled={currentFolderId === f.id}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent disabled:opacity-40"
                >
                  <span className={`h-2 w-2 rounded-full ${COLOR_DOT[color] ?? COLOR_DOT.blue}`} />
                  <span className="truncate">{f.name}</span>
                </button>
              );
            })}
            {folders.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma pasta criada</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FolderDialog({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: FolderRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState<ColorKey>((initial?.color as ColorKey) ?? "blue");
  const [saving, setSaving] = useState(false);
  const createFn = useServerFn(createFolder);
  const renameFn = useServerFn(renameFolder);

  async function submit() {
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    try {
      if (mode === "create") {
        await createFn({ data: { name: n, color } });
        toast.success("Pasta criada");
      } else if (initial) {
        await renameFn({ data: { id: initial.id, name: n, color } });
        toast.success("Pasta atualizada");
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title={mode === "create" ? "Nova pasta" : "Editar pasta"}>
      <label className="mt-2 block text-xs font-medium text-muted-foreground">Nome</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        placeholder="Ex.: Cardiologia"
        className="mt-1 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      <label className="mt-4 block text-xs font-medium text-muted-foreground">Cor</label>
      <div className="mt-2 flex gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={c}
            className={`h-7 w-7 rounded-full ${COLOR_DOT[c]} ring-offset-2 ring-offset-background transition ${
              color === c ? "ring-2 ring-foreground" : "hover:scale-110"
            }`}
          />
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Salvar
        </button>
      </div>
    </Modal>
  );
}

function DeleteFolderButton({
  folder,
  onDone,
}: {
  folder: FolderRow;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const delFn = useServerFn(deleteFolder);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await delFn({ data: { id: folder.id } });
          toast.success("Pasta excluída");
          onDone();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erro");
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      <Trash2 className="h-3.5 w-3.5" /> Excluir pasta
    </button>
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
