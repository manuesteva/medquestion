import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completeOnboarding } from "@/lib/profile.functions";
import { toast } from "sonner";
import { Check, Loader2, Sun, Moon, ArrowRight, GraduationCap, Briefcase, BookOpen, Sparkles, User, UserCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({ component: Onboarding });

const SPECIALTIES = [
  "Clínica Médica", "Cirurgia", "Pediatria", "Ginecologia e Obstetrícia",
  "Cardiologia", "Ortopedia", "Psiquiatria", "Radiologia",
  "Dermatologia", "Anestesiologia", "Medicina Intensiva", "Oftalmologia",
  "Concursos SUS", "Concursos Municipais", "Outros",
];

const GOALS = [
  { v: "residencia", l: "Residência médica", desc: "Provas como USP, Unicamp, ENARE.", icon: GraduationCap },
  { v: "concurso", l: "Concurso público", desc: "Carreiras públicas e SUS.", icon: Briefcase },
  { v: "revisao", l: "Revisão da faculdade", desc: "Reforço durante a graduação.", icon: BookOpen },
  { v: "geral", l: "Estudos gerais", desc: "Conhecimento contínuo.", icon: Sparkles },
];

const GENDERS = [
  { v: "female" as const, l: "Mulher", icon: User },
  { v: "male" as const, l: "Homem", icon: User },
  { v: "neutral" as const, l: "Prefiro não informar", icon: UserCircle2 },
];

function Onboarding() {
  const navigate = useNavigate();
  const submit = useServerFn(completeOnboarding);
  const [step, setStep] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [gender, setGender] = useState<"female" | "male" | "neutral">("neutral");
  const [goal, setGoal] = useState("residencia");
  const [specialty, setSpecialty] = useState("Clínica Médica");
  const [dailyGoal, setDailyGoal] = useState(20);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const steps = ["Aparência", "Você", "Objetivo", "Área", "Meta"];

  async function finish() {
    setLoading(true);
    try {
      await submit({ data: { theme, gender, goal, specialty, daily_goal: dailyGoal } });
      toast.success("Tudo pronto!");
      await navigate({ to: "/dashboard", replace: true });
      // Defensive fallback in case the SPA navigation does not fire.
      setTimeout(() => {
        if (window.location.pathname !== "/dashboard") {
          window.location.assign("/dashboard");
        }
      }, 300);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background transition-colors">
      <div className="mx-auto max-w-2xl px-6 py-10 sm:py-16">
        <div className="mb-10 flex items-center gap-2">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>

        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Passo {step + 1} de {steps.length}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{steps[step]}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === 0 && "Escolha o visual que combina com você. Muda na hora."}
          {step === 1 && "Como você se identifica? Vamos usar para personalizar as mensagens."}
          {step === 2 && "Qual é o seu foco principal de estudo?"}
          {step === 3 && "Qual sua principal área de interesse?"}
          {step === 4 && "Defina uma meta confortável e sustentável."}
        </p>

        <div className="mt-8">
          {step === 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {([
                { v: "light", l: "Modo claro", desc: "Leitura clara e suave.", icon: Sun },
                { v: "dark", l: "Modo escuro", desc: "Conforto à noite.", icon: Moon },
              ] as const).map((t) => {
                const selected = theme === t.v;
                return (
                  <button
                    key={t.v}
                    onClick={() => setTheme(t.v)}
                    className={`relative overflow-hidden rounded-2xl border p-5 text-left transition ${
                      selected ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-foreground/20"
                    }`}
                  >
                    <div className={`mb-4 flex h-28 items-end gap-1.5 rounded-xl p-3 ${t.v === "dark" ? "bg-zinc-900" : "bg-zinc-100"}`}>
                      <div className={`h-2 w-12 rounded-full ${t.v === "dark" ? "bg-zinc-700" : "bg-zinc-300"}`} />
                      <div className={`h-2 w-8 rounded-full ${t.v === "dark" ? "bg-zinc-700" : "bg-zinc-300"}`} />
                      <div className="ml-auto h-2 w-6 rounded-full bg-primary/80" />
                    </div>
                    <div className="flex items-center gap-2">
                      <t.icon className="h-4 w-4" />
                      <span className="font-semibold">{t.l}</span>
                      {selected && <Check className="ml-auto h-4 w-4 text-primary" />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-3">
              {GENDERS.map((g) => {
                const selected = gender === g.v;
                return (
                  <button
                    key={g.v}
                    onClick={() => setGender(g.v)}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                      selected ? "border-primary bg-accent/40 ring-2 ring-primary/15" : "border-border hover:border-foreground/20"
                    }`}
                  >
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
                      <g.icon className="h-5 w-5" />
                    </div>
                    <span className="font-semibold">{g.l}</span>
                    {selected && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {GOALS.map((g) => {
                const selected = goal === g.v;
                return (
                  <button
                    key={g.v}
                    onClick={() => setGoal(g.v)}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                      selected ? "border-primary bg-accent/40 ring-2 ring-primary/15" : "border-border hover:border-foreground/20"
                    }`}
                  >
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
                      <g.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold">{g.l}</div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{g.desc}</p>
                    </div>
                    {selected && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SPECIALTIES.map((s) => {
                const selected = specialty === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSpecialty(s)}
                    className={`rounded-xl border px-3 py-3 text-center text-sm transition ${
                      selected ? "border-primary bg-accent/40 font-semibold ring-2 ring-primary/15" : "border-border hover:border-foreground/20"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}

          {step === 4 && (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <div className="text-6xl font-bold tracking-tight">{dailyGoal}</div>
              <div className="mt-1 text-sm text-muted-foreground">questões por dia</div>
              <input
                type="range" min={5} max={100} step={5} value={dailyGoal}
                onChange={(e) => setDailyGoal(Number(e.target.value))}
                className="mt-8 w-full accent-[var(--color-primary)]"
              />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>5</span><span>50</span><span>100</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 flex items-center justify-between">
          <button disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="rounded-lg px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40">
            Voltar
          </button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={finish} disabled={loading} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Concluir</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
