import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, FileText, Sparkles, BarChart3, Plus } from "lucide-react";


export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "MedQuest — Estude com provas reais e IA" },
      {
        name: "description",
        content:
          "Envie qualquer prova em PDF, a IA extrai as questões, você resolve e recebe explicações no nível de residência.",
      },
    ],
  }),
});

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "O MedQuest é gratuito?",
    a: "Sim! Você pode criar sua conta gratuitamente e começar a usar agora mesmo.",
  },
  {
    q: "Que tipo de arquivo posso enviar?",
    a: "Você pode enviar provas em PDF, imagem (JPG, PNG) ou texto. O sistema aceita provas digitalizadas, fotografadas ou arquivos digitais.",
  },
  {
    q: "Como a IA extrai as questões?",
    a: "Após o upload, nossa IA analisa o documento automaticamente, identifica cada questão e as organiza para você resolver. Tudo isso em poucos segundos.",
  },
  {
    q: "As explicações são confiáveis?",
    a: "Sim. As explicações são geradas por IA treinada no nível de residência médica, com justificativas detalhadas para cada alternativa — certa e errada.",
  },
  {
    q: "Funciona para qualquer banca?",
    a: "Sim! O MedQuest funciona com provas de qualquer banca de residência médica e concursos da área da saúde.",
  },
  {
    q: "Meu progresso fica salvo?",
    a: "Sim. Todo o histórico de acertos, erros, sequência de estudos e desempenho por matéria ficam salvos no dashboard.",
  },
  {
    q: "Consigo usar no celular?",
    a: "Sim, o MedQuest funciona perfeitamente no celular e no computador.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
            M
          </div>
          <span className="text-lg font-semibold tracking-tight">MedQuest</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Entrar
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Começar grátis <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-12 pb-24 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <Sparkles className="h-3 w-3" /> Extração automática de questões com IA
          </div>
          <h1 className="mt-6 text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
            Suas provas, transformadas em estudo inteligente.
          </h1>
          <p className="mt-5 text-balance text-lg text-muted-foreground">
            Envie qualquer prova em PDF ou imagem. A IA identifica as questões, você resolve e
            recebe explicações no nível de residência médica.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-elegant)] hover:bg-primary/90"
            >
              Criar conta grátis <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent"
            >
              Já tenho conta
            </Link>
          </div>
        </div>

        <section
          id="como-funciona"
          className="mx-auto mt-20 grid max-w-5xl gap-4 scroll-mt-24 sm:grid-cols-3"
        >
          {[
            {
              icon: FileText,
              t: "Upload de provas",
              d: "PDFs digitalizados, imagens, provas antigas. Tudo vira questão estruturada.",
            },
            {
              icon: Sparkles,
              t: "Explicações com IA",
              d: "Justificativas detalhadas para cada alternativa, no nível da prova.",
            },
            {
              icon: BarChart3,
              t: "Dashboard premium",
              d: "Acerto, evolução semanal, matérias fortes e fracas. Tudo em um lugar.",
            },
          ].map(({ icon: Icon, t, d }) => (
            <div
              key={t}
              className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
            >
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-semibold">{t}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </section>
      </main>

      <FaqSection />
    </div>
  );
}

function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section
      style={{ backgroundColor: "#eef2ff" }}
      className="w-full px-6 py-20"
    >
      <div className="mx-auto w-full" style={{ maxWidth: 720 }}>
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Dúvidas
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Perguntas frequentes
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Tudo o que você precisa saber antes de começar.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {FAQ_ITEMS.map((item, i) => {
            const open = openIdx === i;
            return (
              <div
                key={item.q}
                className="overflow-hidden rounded-2xl border bg-white transition-colors"
                style={{
                  borderColor: open ? "#bfdbfe" : "rgba(15, 31, 92, 0.08)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition active:scale-[0.998] sm:px-6 sm:py-5"
                  style={{
                    minHeight: 48,
                    color: open ? "#2563eb" : undefined,
                  }}
                >
                  <span className="text-base font-semibold sm:text-lg">
                    {item.q}
                  </span>
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all duration-300 sm:h-9 sm:w-9"
                    style={{
                      backgroundColor: open ? "#2563eb" : "rgba(37, 99, 235, 0.08)",
                      color: open ? "#ffffff" : "#2563eb",
                      transform: open ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </span>
                </button>
                <div
                  className="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
                >
                  <div className="min-h-0">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6 sm:pb-6 sm:text-base">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
