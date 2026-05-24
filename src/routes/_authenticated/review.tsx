import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/review")({ component: Review });

function Review() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Revisar</h1>
      <p className="mt-1 text-sm text-muted-foreground">Volte para o que importa.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          to="/practice"
          search={{ wrong: true, favorites: false, specialty: undefined }}
          className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 hover:bg-accent/40"
        >
          <XCircle className="h-5 w-5 text-destructive" />
          <div>
            <div className="font-medium">Questões que errei</div>
            <div className="text-sm text-muted-foreground">Revise os erros recentes</div>
          </div>
        </Link>
        <Link
          to="/practice"
          search={{ favorites: true, wrong: false, specialty: undefined }}
          className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 hover:bg-accent/40"
        >
          <Bookmark className="h-5 w-5 text-primary" />
          <div>
            <div className="font-medium">Favoritas</div>
            <div className="text-sm text-muted-foreground">As que você marcou para revisar</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
