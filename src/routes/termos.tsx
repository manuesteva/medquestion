import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";


export const Route = createFileRoute("/termos")({
  component: TermosPage,
  head: () => ({
    meta: [
      { title: "Termos de uso — MedQuest" },
      {
        name: "description",
        content:
          "Termos de uso da plataforma MedQuest: regras de utilização, responsabilidades e limites do serviço.",
      },
      { property: "og:title", content: "Termos de uso — MedQuest" },
      {
        property: "og:description",
        content: "Regras de uso da plataforma MedQuest.",
      },
    ],
  }),
});

function TermosPage() {
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
          Termos de uso
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: 24 de maio de 2025
        </p>

        <div className="prose prose-neutral mt-8 max-w-none text-sm leading-relaxed text-foreground/90">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">1. Aceitação dos termos</h2>
            <p>
              Ao criar uma conta e utilizar o MedQuest, você concorda com estes
              Termos de uso. Caso não concorde, não utilize a plataforma.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold">2. Cadastro e conta</h2>
            <p>
              Você é responsável por manter a confidencialidade das suas
              credenciais. Forneça informações verdadeiras no cadastro e
              mantenha seus dados atualizados.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold">3. Uso do conteúdo</h2>
            <p>
              O conteúdo gerado pela IA (questões extraídas, explicações,
              comentários) tem fins exclusivamente educacionais e não substitui
              o estudo formal, julgamento clínico ou parecer profissional.
            </p>
            <p>
              Você se compromete a enviar apenas materiais para os quais possui
              direito de uso ou que estejam em domínio público.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold">4. Limitações de responsabilidade</h2>
            <p>
              O MedQuest é fornecido "como está". Não garantimos disponibilidade
              ininterrupta nem precisão absoluta das explicações geradas por
              IA. Em nenhuma hipótese seremos responsáveis por decisões
              clínicas ou acadêmicas tomadas com base no conteúdo da
              plataforma.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold">5. Encerramento</h2>
            <p>
              Você pode encerrar sua conta a qualquer momento nas configurações
              do app. Reservamo-nos o direito de suspender contas que violarem
              estes termos.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold">6. Alterações</h2>
            <p>
              Estes termos podem ser atualizados periodicamente. Notificaremos
              mudanças relevantes pelo e-mail cadastrado.
            </p>
          </section>

          <p className="mt-10 text-xs text-muted-foreground">
            Este é um texto placeholder. Substitua por seus termos legais
            definitivos antes do lançamento em produção.
          </p>
        </div>
      </main>
    </div>
  );
}
