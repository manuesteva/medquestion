import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

export function SiteFooter() {
  return (
    <footer
      className="mt-16 w-full"
      style={{ backgroundColor: "#0f1f5c", color: "#ffffff" }}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-3">
        {/* Marca */}
        <div>
          <div className="text-xl font-bold tracking-tight">
            <span className="text-white">Med</span>
            <span style={{ color: "#93c5fd" }}>Quest</span>
          </div>
          <p
            className="mt-3 max-w-xs text-sm leading-relaxed"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            Estude com inteligência. Seja aprovado.
          </p>
        </div>

        {/* App */}
        <div>
          <h3
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            App
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link
                to="/signup"
                className="inline-flex min-h-[2.5rem] items-center text-white/90 transition hover:text-white"
              >
                Criar conta grátis
              </Link>
            </li>
            <li>
              <Link
                to="/login"
                className="inline-flex min-h-[2.5rem] items-center text-white/90 transition hover:text-white"
              >
                Entrar
              </Link>
            </li>
            <li>
              <Link
                to="/"
                hash="como-funciona"
                className="inline-flex min-h-[2.5rem] items-center text-white/90 transition hover:text-white"
              >
                Como funciona
              </Link>
            </li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h3
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            Legal
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link
                to="/termos"
                className="inline-flex min-h-[2.5rem] items-center text-white/90 transition hover:text-white"
              >
                Termos de uso
              </Link>
            </li>
            <li>
              <Link
                to="/privacidade"
                className="inline-flex min-h-[2.5rem] items-center text-white/90 transition hover:text-white"
              >
                Política de privacidade
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div
        className="border-t"
        style={{ borderColor: "rgba(255,255,255,0.1)" }}
      >
        <div
          className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-5 text-xs sm:flex-row sm:items-center"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          <p>© 2025 MedQuest. Todos os direitos reservados.</p>
          <p className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Em conformidade com a LGPD
          </p>
        </div>
      </div>
      {/* Extra space on mobile so the fixed bottom nav (in authenticated routes) doesn't cover the footer */}
      <div className="h-20 sm:hidden" aria-hidden="true" />
    </footer>
  );
}
