import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import {
  ArrowRight,
  FileText,
  Sparkles,
  BarChart3,
  Plus,
  Upload,
  Brain,
  Trophy,
  Clock,
  Target,
  Zap,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "MedQuest — Estude para residência médica com IA" },
      {
        name: "description",
        content:
          "Envie qualquer prova em PDF, a IA extrai as questões, você resolve e recebe explicações no nível de residência. Comece grátis.",
      },
      { property: "og:title", content: "MedQuest — Estude para residência médica com IA" },
      {
        property: "og:description",
        content:
          "Transforme provas em estudo inteligente. IA extrai questões, gera explicações e acompanha seu progresso.",
      },
    ],
  }),
});

/* ---------- Variants ---------- */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

/* ---------- Header ---------- */
function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-border/40 bg-background/70 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div
            className="grid h-9 w-9 place-items-center rounded-xl font-bold text-white shadow-lg"
            style={{ background: "var(--gradient-primary)" }}
          >
            M
          </div>
          <span className="font-display text-lg font-bold tracking-tight">MedQuest</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
            Recursos
          </a>
          <a href="#como-funciona" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
            Como funciona
          </a>
          <a href="#faq" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="hidden text-sm font-medium text-muted-foreground transition hover:text-foreground sm:inline-block"
          >
            Entrar
          </Link>
          <Link
            to="/signup"
            className="group inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition hover:scale-105 hover:shadow-xl"
          >
            Começar grátis
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ---------- Hero ---------- */
function Hero() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 400], [0, 60]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0.3]);

  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Mesh background */}
      <div className="absolute inset-0 bg-mesh" />
      <motion.div
        style={{ y }}
        className="absolute -top-20 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
      >
        <div className="h-full w-full" style={{ background: "var(--gradient-primary)" }} />
      </motion.div>

      <motion.div
        style={{ opacity }}
        className="relative mx-auto max-w-4xl px-6 text-center"
      >
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center"
        >
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--ocean-teal)" }} />
            IA treinada no nível de residência médica
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="font-display mt-6 text-balance text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl"
          >
            Suas provas,{" "}
            <span className="text-gradient-ocean animate-shimmer">
              transformadas em estudo
            </span>{" "}
            inteligente.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl"
          >
            Envie qualquer prova em PDF ou imagem. A IA identifica cada questão,
            você resolve e recebe explicações detalhadas e direcionadas.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              to="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-xl transition hover:scale-105"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              Criar conta grátis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center rounded-full border border-border bg-card/80 px-6 py-3 text-sm font-semibold backdrop-blur transition hover:bg-card"
            >
              Já tenho conta
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"
          >
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--ocean-teal)" }} />
            Grátis para começar
            <span className="mx-2">·</span>
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--ocean-teal)" }} />
            Sem cartão de crédito
          </motion.div>
        </motion.div>

        {/* Mockup card */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
          className="relative mx-auto mt-16 max-w-3xl"
        >
          <div
            className="absolute -inset-4 rounded-3xl opacity-40 blur-2xl"
            style={{ background: "var(--gradient-primary)" }}
          />
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <div className="ml-4 flex-1 truncate text-xs text-muted-foreground">
                medquest.app/practice
              </div>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-3">
              <MockStat label="Questões resolvidas" value="1.247" icon={Target} />
              <MockStat label="Taxa de acerto" value="78%" icon={Trophy} />
              <MockStat label="Sequência" value="12 dias" icon={Zap} />
            </div>
            <div className="border-t border-border bg-muted/30 p-6">
              <div className="flex items-start gap-3">
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Explicação da IA · USP 2024
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "85%" }}
                      transition={{ duration: 1.5, delay: 1.2 }}
                      className="h-full rounded-full"
                      style={{ background: "var(--gradient-primary)" }}
                    />
                  </div>
                  <div className="mt-2 h-2 w-3/4 rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "60%" }}
                      transition={{ duration: 1.2, delay: 1.5 }}
                      className="h-full rounded-full"
                      style={{ background: "var(--gradient-primary)" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function MockStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="font-display mt-2 text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/* ---------- Stats bar ---------- */
function StatsBar() {
  const items = [
    { v: "10k+", l: "Questões processadas" },
    { v: "500+", l: "Provas disponíveis" },
    { v: "98%", l: "Precisão da extração" },
    { v: "24/7", l: "Disponibilidade" },
  ];
  return (
    <motion.section
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      variants={stagger}
      className="border-y border-border bg-card"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 sm:grid-cols-4">
        {items.map((s) => (
          <motion.div key={s.l} variants={fadeUp} className="text-center">
            <div className="font-display text-3xl font-bold text-gradient-ocean sm:text-4xl">
              {s.v}
            </div>
            <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.l}</div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

/* ---------- Features ---------- */
function Features() {
  const features = [
    {
      icon: FileText,
      title: "Upload inteligente",
      desc: "PDFs digitalizados, fotografias ou arquivos digitais. Tudo vira questão estruturada em segundos.",
    },
    {
      icon: Brain,
      title: "IA nível residência",
      desc: "Explicações detalhadas para cada alternativa — certa e errada — com referências e raciocínio clínico.",
    },
    {
      icon: BarChart3,
      title: "Dashboard premium",
      desc: "Acompanhe acertos, evolução semanal, matérias fortes e fracas. Tudo num lugar elegante.",
    },
    {
      icon: Clock,
      title: "Simulado cronometrado",
      desc: "Treine como na prova real. Defina tempo e número de questões, retome de onde parou.",
    },
    {
      icon: Target,
      title: "Rever depois",
      desc: "Marque questões para revisitar. Volte sempre que quiser para consolidar o aprendizado.",
    },
    {
      icon: Sparkles,
      title: "Biblioteca organizada",
      desc: "Pastas coloridas, busca global e filtros para encontrar qualquer prova em segundos.",
    },
  ];
  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={stagger}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.div variants={fadeUp} className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ocean-teal)" }}>
            Recursos
          </motion.div>
          <motion.h2 variants={fadeUp} className="font-display mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Tudo para estudar com{" "}
            <span className="text-gradient-ocean">inteligência</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
            Recursos pensados para quem leva a residência a sério.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          variants={stagger}
          className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map(({ icon: Icon, title, desc }) => (
            <motion.div
              key={title}
              variants={fadeUp}
              whileHover={{ y: -6 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-xl"
            >
              <div
                className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-30"
                style={{ background: "var(--gradient-primary)" }}
              />
              <div
                className="relative grid h-11 w-11 place-items-center rounded-xl text-white shadow-md"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display relative mt-5 text-lg font-semibold">{title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- How it works ---------- */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: Upload,
      title: "Envie a prova",
      desc: "Faça upload de qualquer PDF ou imagem. Banca, ano, qualquer formato.",
    },
    {
      n: "02",
      icon: Brain,
      title: "A IA processa",
      desc: "Em segundos, cada questão é extraída e estruturada para você.",
    },
    {
      n: "03",
      icon: Trophy,
      title: "Estude e evolua",
      desc: "Resolva, receba explicações, acompanhe sua evolução no dashboard.",
    },
  ];
  return (
    <section id="como-funciona" className="relative overflow-hidden py-24">
      <div
        className="absolute inset-0 opacity-50"
        style={{ background: "var(--gradient-mesh)" }}
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={stagger}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.div variants={fadeUp} className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ocean-teal)" }}>
            Em 3 passos
          </motion.div>
          <motion.h2 variants={fadeUp} className="font-display mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Como funciona
          </motion.h2>
        </motion.div>

        <div className="relative mt-16 grid gap-8 sm:grid-cols-3">
          {/* Connector line */}
          <div className="absolute left-0 right-0 top-12 hidden h-px sm:block">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
              style={{
                background: "var(--gradient-primary)",
                transformOrigin: "left",
              }}
              className="h-full w-full opacity-30"
            />
          </div>

          {steps.map(({ n, icon: Icon, title, desc }, i) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="relative text-center"
            >
              <div className="relative mx-auto grid h-24 w-24 place-items-center">
                <div
                  className="absolute inset-0 rounded-full opacity-30 blur-xl"
                  style={{ background: "var(--gradient-primary)" }}
                />
                <div
                  className="relative grid h-24 w-24 place-items-center rounded-full border-4 border-background text-white shadow-2xl"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <Icon className="h-9 w-9" />
                </div>
              </div>
              <div className="font-display mt-4 text-xs font-bold tracking-widest" style={{ color: "var(--ocean-teal)" }}>
                PASSO {n}
              </div>
              <h3 className="font-display mt-2 text-xl font-semibold">{title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Testimonials ---------- */
function Testimonials() {
  const items = [
    {
      quote: "Mudou minha forma de estudar. Em 2 meses já vi diferença nos simulados.",
      name: "Dra. Carolina M.",
      role: "R1 Clínica Médica",
    },
    {
      quote: "A IA explica como um preceptor. Finalmente entendo o porquê das respostas.",
      name: "João P., M6",
      role: "Preparação USP/UNIFESP",
    },
    {
      quote: "Subo provas antigas e treino direcionado. Dashboard é viciante.",
      name: "Marina S.",
      role: "Residência de Pediatria",
    },
  ];
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={stagger}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.div variants={fadeUp} className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ocean-teal)" }}>
            Quem usa, recomenda
          </motion.div>
          <motion.h2 variants={fadeUp} className="font-display mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Para quem leva o estudo a sério
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
          className="mt-14 grid gap-5 md:grid-cols-3"
        >
          {items.map((t) => (
            <motion.figure
              key={t.name}
              variants={fadeUp}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-lg"
            >
              <div className="flex gap-1" style={{ color: "var(--ocean-teal)" }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Sparkles key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 text-base leading-relaxed">"{t.quote}"</blockquote>
              <figcaption className="mt-4 border-t border-border pt-4">
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </figcaption>
            </motion.figure>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Final CTA ---------- */
function FinalCTA() {
  return (
    <section className="px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-8 py-16 text-center shadow-2xl sm:px-16 sm:py-20"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative">
          <h2 className="font-display text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Pronto para estudar de um jeito novo?
          </h2>
          <p className="mt-4 text-balance text-lg text-white/80">
            Crie sua conta grátis e envie sua primeira prova em menos de 1 minuto.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-primary shadow-xl transition hover:scale-105"
            >
              Criar conta grátis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* ---------- FAQ ---------- */
const FAQ_ITEMS: { q: string; a: string }[] = [
  { q: "O MedQuest é gratuito?", a: "Sim! Você pode criar sua conta gratuitamente e começar a usar agora mesmo." },
  { q: "Que tipo de arquivo posso enviar?", a: "PDFs, imagens (JPG, PNG) ou texto. Provas digitalizadas, fotografadas ou digitais." },
  { q: "Como a IA extrai as questões?", a: "Após o upload, a IA analisa o documento, identifica cada questão e organiza para você resolver em segundos." },
  { q: "As explicações são confiáveis?", a: "Sim. As explicações são geradas por IA treinada no nível de residência médica, com justificativas detalhadas." },
  { q: "Funciona para qualquer banca?", a: "Sim! Funciona com provas de qualquer banca de residência médica e concursos da área da saúde." },
  { q: "Meu progresso fica salvo?", a: "Sim. Todo o histórico de acertos, erros, sequência de estudos e desempenho por matéria ficam salvos no dashboard." },
  { q: "Consigo usar no celular?", a: "Sim, o MedQuest funciona perfeitamente no celular e no computador." },
];

function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section id="faq" className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={stagger}
          className="text-center"
        >
          <motion.div variants={fadeUp} className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ocean-teal)" }}>
            Dúvidas
          </motion.div>
          <motion.h2 variants={fadeUp} className="font-display mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Perguntas frequentes
          </motion.h2>
        </motion.div>

        <div className="mt-12 space-y-3">
          {FAQ_ITEMS.map((item, i) => {
            const open = openIdx === i;
            return (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={`overflow-hidden rounded-2xl border bg-card transition-colors ${
                  open ? "border-primary/40 shadow-lg" : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition active:scale-[0.998] sm:px-6 sm:py-5"
                >
                  <span className={`font-display text-base font-semibold sm:text-lg ${open ? "text-primary" : ""}`}>
                    {item.q}
                  </span>
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all duration-300 sm:h-9 sm:w-9 ${
                      open ? "bg-primary text-primary-foreground" : "bg-muted text-primary"
                    }`}
                    style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
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
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- Page ---------- */
function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />
      <main>
        <Hero />
        <StatsBar />
        <Features />
        <HowItWorks />
        <Testimonials />
        <FaqSection />
        <FinalCTA />
      </main>
    </div>
  );
}
