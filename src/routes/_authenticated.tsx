import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyContext, updateTheme } from "@/lib/profile.functions";
import { Loader2, LayoutGrid, Upload, Brain, Library, Settings, Sun, Moon, GraduationCap } from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";

export const Route = createFileRoute("/_authenticated")({ component: AuthenticatedLayout });

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();

  const getCtx = useServerFn(getMyContext);
  const setThemeFn = useServerFn(updateTheme);
  const ctxQuery = useQuery({
    queryKey: ["my-context", user?.id],
    queryFn: () => getCtx(),
    enabled: !!user,
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const theme = ctxQuery.data?.profile?.theme as "light" | "dark" | undefined;
  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);

  useEffect(() => {
    if (!ctxQuery.data) return;
    const onboarded = ctxQuery.data.profile?.onboarded;
    if (!onboarded && path !== "/onboarding") {
      navigate({ to: "/onboarding" });
    }
  }, [ctxQuery.data, path, navigate]);

  async function toggleTheme() {
    const next: "light" | "dark" = theme === "dark" ? "light" : "dark";
    // optimistic
    if (next === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    qc.setQueryData(["my-context", user?.id], (prev: unknown) => {
      const p = prev as { profile?: Record<string, unknown> } | undefined;
      if (!p?.profile) return prev;
      return { ...p, profile: { ...p.profile, theme: next } };
    });
    try { await setThemeFn({ data: { theme: next } }); } catch {}
  }

  if (loading || !user || ctxQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const onboarded = ctxQuery.data?.profile?.onboarded ?? false;
  if (!onboarded) {
    return <Outlet />;
  }

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
    { to: "/practice", label: "Praticar", icon: Brain },
    { to: "/upload", label: "Enviar", icon: Upload },
    { to: "/library", label: "Biblioteca", icon: Library },
    { to: "/settings", label: "Ajustes", icon: Settings },
  ] as const;

  const hideChrome = path.startsWith("/simulado") || path.startsWith("/practice");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-base font-bold tracking-tight">MedQuest</span>
        </Link>
        <div className="flex items-center gap-2">
          <GlobalSearch />
          <button
            onClick={toggleTheme}
            aria-label="Alternar tema"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground transition active:scale-95 hover:bg-accent"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className={`mx-auto w-full max-w-5xl ${hideChrome ? "pb-6" : "pb-24"}`}>
        <Outlet />
      </main>

      {/* Bottom Nav */}
      {!hideChrome && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl">
            {nav.map(({ to, label, icon: Icon }) => {
              const active = to === "/dashboard" ? path === "/dashboard" : path.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-[11px] font-medium transition active:scale-95 ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
