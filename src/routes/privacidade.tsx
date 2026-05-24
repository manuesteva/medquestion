import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";


export const Route = createFileRoute("/privacidade")({
  component: PrivacidadePage,
  head: () => ({
    meta: [
      { title: "Política de privacidade — MedQuest" },
      {
        name: "description",
        content:
          "Como o MedQuest coleta, usa e protege seus dados pessoais, em conformidade com a LGPD.",
      },
      { property: "og:title", content: "Política de privacidade — MedQuest" },
      {
        property: "og:description",
        content:
          "Privacidade e proteção de dados na plataforma MedQuest.",
      },
    ],
  }),
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Política de privacidade
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: 24 de maio de 2025
        </p>

        <div className="prose prose-neutral mt-8 max-w-none text-sm leading-relaxed text-foreground/90">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">1. Dados que coletamos</h2>
            <p>
              Coletamos: nome, e-mail, gênero (opcional), preferências de
              estudo, provas enviadas (PDFs, imagens ou texto), respostas a
              questões e estatísticas de desempenho.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold">2. Como usamos seus dados</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Para personalizar sua experiência de estudo.</li>
              <li>
                Para processar provas com IA e gerar questões e explicações.
              </li>
              <li>Para calcular estatísticas e gráficos de progresso.</li>
              <li>Para enviar notificações relacionadas à sua conta.</li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold">3. Compartilhamento</h2>
            <p>
              Seus dados não são vendidos. Compartilhamos apenas com
              processadores essenciais (infraestrutura de nuvem e provedor de
              IA) sob acordos de confidencialidade.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold">4. Seus direitos (LGPD)</h2>
            <p>
              Você pode acessar, corrigir ou excluir seus dados a qualquer
              momento. A exclusão da conta nas configurações remove todos os
              seus dados de forma irreversível.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold">5. Segurança</h2>
            <p>
              Adotamos criptografia em trânsito (HTTPS) e em repouso, além de
              controles de acesso por linha (RLS) no banco de dados.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold">6. Contato</h2>
            <p>
              Dúvidas sobre privacidade podem ser enviadas pelo e-mail de
              suporte indicado no app.
            </p>
          </section>

          <p className="mt-10 text-xs text-muted-foreground">
            Este é um texto placeholder. Substitua por sua política de
            privacidade definitiva antes do lançamento em produção.
          </p>
        </div>
      </main>
    </div>
  );
}
