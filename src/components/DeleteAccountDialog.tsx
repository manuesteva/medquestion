import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { deleteMyAccount } from "@/lib/account.functions";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, X, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const fn = useServerFn(deleteMyAccount);
  const { signOut } = useAuth();
  const nav = useNavigate();
  const [ack, setAck] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const canDelete = ack && text === "EXCLUIR";

  async function performDelete() {
    if (!canDelete) return;
    setLoading(true);
    try {
      const r = await fn({ data: { confirmation: "EXCLUIR" } });
      if (!r.ok) {
        toast.error(r.error);
        setLoading(false);
        return;
      }
      toast.success("Conta excluída");
      await signOut();
      nav({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-destructive/40 bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-destructive">Excluir conta</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Esta ação <strong className="text-foreground">não pode ser desfeita</strong>. Todos os
          seus dados — perfil, provas, questões, tentativas, favoritos, notas e pastas — serão
          removidos permanentemente.
        </p>

        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border"
          />
          Entendo que esta exclusão é permanente e irreversível.
        </label>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Digite <strong className="text-foreground">EXCLUIR</strong> para confirmar
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="EXCLUIR"
            className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm uppercase tracking-wider outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/15"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={performDelete}
            disabled={!canDelete || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Excluir definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}
