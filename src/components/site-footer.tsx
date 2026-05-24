import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-16 w-full border-t border-border bg-background text-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-3">
        <div>
          <div className="text-xl font-bold tracking-tight">
            <span>Med</span>
            <span className="text-primary">Quest</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Estude com inteligência. Seja aprovado.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            App
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link
                to="/signup"
                className="inline-flex min-h-[2.5rem] items-center text-muted-foreground transition hover:text-foreground"
              >
                Criar conta grátis
              </Link>
            </li>
            <li>
              <Link
                to="/login"
                className="inline-flex min-h-[2.5rem] items-center text-muted-foreground transition hover:text-foreground"
              >
                Entrar
              </Link>
            </li>
            <li>
              <Link
                to="/"
                hash="como-funciona"
                className="inline-flex min-h-[2.5rem] items-center text-muted-foreground transition hover:text-foreground"
              >
                Como funciona
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Legal
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link
                to="/termos"
                className="inline-flex min-h-[2.5rem] items-center text-muted-foreground transition hover:text-foreground"
              >
                Termos de uso
              </Link>
            </li>
            <li>
              <Link
                to="/privacidade"
                className="inline-flex min-h-[2.5rem] items-center text-muted-foreground transition hover:text-foreground"
              >
                Política de privacidade
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© 2025 MedQuest. Todos os direitos reservados.</p>
          <p className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Em conformidade com a LGPD
          </p>
        </div>
      </div>
      <div className="h-20 sm:hidden" aria-hidden="true" />
    </footer>
  );
}