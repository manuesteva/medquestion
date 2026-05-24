import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyContext,
  updateGender,
  updateDailyGoal,
  updateFullName,
  updateAvatarUrl,
} from "@/lib/profile.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";
import { toast } from "sonner";
import { LogOut, User, Target, Loader2, KeyRound, Trash2, Mail, Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({ component: Settings });

type Gender = "female" | "male" | "neutral";

function Settings() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const getCtx = useServerFn(getMyContext);
  const setGenderFn = useServerFn(updateGender);
  const setGoalFn = useServerFn(updateDailyGoal);
  const setNameFn = useServerFn(updateFullName);
  const setAvatarFn = useServerFn(updateAvatarUrl);
  const ctx = useQuery({ queryKey: ["my-context", user?.id], queryFn: () => getCtx() });

  const profile = ctx.data?.profile;
  const prefs = ctx.data?.prefs;

  const [name, setName] = useState(profile?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [goal, setGoal] = useState(prefs?.daily_goal ?? 10);
  const [savingG, setSavingG] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile?.full_name) setName(profile.full_name);
  }, [profile?.full_name]);
  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);
  useEffect(() => {
    if (prefs?.daily_goal) setGoal(prefs.daily_goal);
  }, [prefs?.daily_goal]);

  async function changeGender(g: Gender) {
    setSavingG(true);
    try {
      await setGenderFn({ data: { gender: g } });
      await qc.invalidateQueries({ queryKey: ["my-context"] });
      toast.success("Salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingG(false);
    }
  }
  async function saveName() {
    setSavingName(true);
    try {
      await setNameFn({ data: { full_name: name.trim() } });
      await qc.invalidateQueries({ queryKey: ["my-context"] });
      toast.success("Nome atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingName(false);
    }
  }
  async function saveEmail() {
    if (!email.trim() || email === user?.email) return;
    setSavingEmail(true);
    setEmailNotice(null);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setSavingEmail(false);
    if (error) {
      toast.error(error.message);
    } else {
      setEmailNotice("Verifique seu novo e-mail para confirmar a troca.");
      toast.success("E-mail de confirmação enviado");
    }
  }
  async function saveGoal() {
    try {
      await setGoalFn({ data: { daily_goal: goal } });
      await qc.invalidateQueries({ queryKey: ["my-context"] });
      await qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Meta atualizada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }
  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 2 MB)");
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      toast.error("Formato inválido (use PNG, JPG ou WEBP)");
      return;
    }
    setSavingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      await setAvatarFn({ data: { avatar_url: pub.publicUrl } });
      await qc.invalidateQueries({ queryKey: ["my-context"] });
      toast.success("Avatar atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setSavingAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const gender = (profile?.gender as Gender | undefined) ?? "neutral";
  const initials = (profile?.full_name ?? user?.email ?? "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>

      {/* PERFIL */}
      <h2 className="mt-6 mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Perfil
      </h2>

      <section className="rounded-[20px] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {initials}
              </div>
            )}
            {savingAvatar && (
              <div className="absolute inset-0 grid place-items-center rounded-full bg-foreground/40">
                <Loader2 className="h-4 w-4 animate-spin text-background" />
              </div>
            )}
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={onPickAvatar}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Camera className="h-3.5 w-3.5" /> Alterar foto
            </button>
            <p className="mt-1 text-[10px] text-muted-foreground">PNG, JPG ou WEBP — até 2 MB</p>
          </div>
        </div>

        {/* Nome */}
        <div className="mt-5">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome completo</label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="flex-1 rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <button
              onClick={saveName}
              disabled={savingName || !name.trim() || name === profile?.full_name}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </button>
          </div>
        </div>

        {/* E-mail */}
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <button
              onClick={saveEmail}
              disabled={savingEmail || !email.trim() || email === user?.email}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-40"
            >
              {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Alterar
            </button>
          </div>
          {emailNotice && (
            <p className="mt-1.5 text-xs text-primary">{emailNotice}</p>
          )}
        </div>

        {/* Gênero */}
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <User className="h-3.5 w-3.5" /> Como me chamar
            {savingG && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                { v: "female", l: "Mulher" },
                { v: "male", l: "Homem" },
                { v: "neutral", l: "Prefiro não informar" },
              ] as const
            ).map((g) => (
              <button
                key={g.v}
                onClick={() => changeGender(g.v)}
                className={`rounded-xl border p-3 text-sm font-medium transition active:scale-95 ${
                  gender === g.v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary"
                }`}
              >
                {g.l}
              </button>
            ))}
          </div>
        </div>

        {/* Meta diária */}
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Target className="h-3.5 w-3.5" /> Meta diária
          </div>
          <div className="rounded-xl bg-accent/40 p-4 text-center">
            <div className="text-4xl font-bold tracking-tight">{goal}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">questões por dia</div>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--color-primary)]"
            />
            <button
              onClick={saveGoal}
              disabled={goal === prefs?.daily_goal}
              className="mt-2 rounded-full bg-primary px-5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              Salvar meta
            </button>
          </div>
        </div>
      </section>

      {/* CONTA */}
      <h2 className="mt-8 mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Conta
      </h2>

      <section className="rounded-[20px] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <button
          onClick={() => setShowPwd(true)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-accent"
        >
          <span className="flex items-center gap-2.5">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Trocar senha
          </span>
          <span className="text-xs text-muted-foreground">→</span>
        </button>
        <button
          onClick={async () => {
            await signOut();
            toast.success("Até mais!");
            window.location.href = "/login";
          }}
          className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-accent"
        >
          <span className="flex items-center gap-2.5">
            <LogOut className="h-4 w-4 text-muted-foreground" />
            Sair
          </span>
          <span className="text-xs text-muted-foreground">→</span>
        </button>
      </section>

      <section className="mt-3 rounded-[20px] border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-destructive">Excluir conta</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Remove permanentemente seu perfil, provas, questões e todo o histórico. Esta ação não
              pode ser desfeita.
            </p>
          </div>
          <button
            onClick={() => setShowDel(true)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-destructive/50 bg-card px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir conta
          </button>
        </div>
      </section>

      {showPwd && <ChangePasswordDialog onClose={() => setShowPwd(false)} />}
      {showDel && <DeleteAccountDialog onClose={() => setShowDel(false)} />}
    </div>
  );
}
