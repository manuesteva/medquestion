import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: attempts }, { data: questions }, { data: prefs }] = await Promise.all([
      supabase
        .from("attempts")
        .select("is_correct, time_ms, created_at, question_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("questions").select("id, subject").eq("user_id", userId),
      supabase.from("user_preferences").select("daily_goal").eq("user_id", userId).maybeSingle(),
    ]);

    const all = attempts ?? [];
    const total = all.length;
    const correct = all.filter((a) => a.is_correct).length;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;
    const avgTime = total
      ? Math.round(all.reduce((s, a) => s + a.time_ms, 0) / total / 1000)
      : 0;

    // today
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayCount = all.filter((a) => a.created_at.slice(0, 10) === todayKey).length;
    const dailyGoal = prefs?.daily_goal ?? 10;

    // streak
    const days = new Set(all.map((a) => a.created_at.slice(0, 10)));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (days.has(key)) streak++;
      else if (i > 0) break;
    }

    // weekly (7 days: correct + wrong)
    const weekly: { day: string; correct: number; wrong: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayAttempts = all.filter((a) => a.created_at.slice(0, 10) === key);
      weekly.push({
        day: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3),
        correct: dayAttempts.filter((a) => a.is_correct).length,
        wrong: dayAttempts.filter((a) => !a.is_correct).length,
      });
    }

    // by subject
    const qSubject = new Map((questions ?? []).map((q) => [q.id, q.subject ?? "Outros"]));
    const bySubject = new Map<string, { total: number; correct: number }>();
    for (const a of all) {
      const subj = qSubject.get(a.question_id) ?? "Outros";
      const cur = bySubject.get(subj) ?? { total: 0, correct: 0 };
      cur.total++;
      if (a.is_correct) cur.correct++;
      bySubject.set(subj, cur);
    }
    const subjects = Array.from(bySubject.entries())
      .map(([subject, v]) => ({
        subject,
        total: v.total,
        correct: v.correct,
        accuracy: v.total ? Math.round((v.correct / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const strong = [...subjects].filter((s) => s.total >= 3).sort((a, b) => b.accuracy - a.accuracy).slice(0, 3);
    const weak = [...subjects].filter((s) => s.total >= 3).sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);

    return {
      total,
      correct,
      accuracy,
      avgTimeSec: avgTime,
      streak,
      todayCount,
      dailyGoal,
      weekly,
      subjects,
      strong,
      weak,
      totalQuestions: questions?.length ?? 0,
    };
  });

export const getLongTermProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("attempts")
      .select("is_correct, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    const all = data ?? [];

    // ISO week key: YYYY-Www (Mon-based)
    function weekKey(d: Date) {
      const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    }

    const today = new Date();
    // Build last 12 weeks buckets
    const weekly: { label: string; key: string; total: number; correct: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i * 7);
      weekly.push({
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        key: weekKey(d),
        total: 0,
        correct: 0,
      });
    }
    const weekIdx = new Map(weekly.map((w, i) => [w.key, i]));
    for (const a of all) {
      const k = weekKey(new Date(a.created_at));
      const i = weekIdx.get(k);
      if (i !== undefined) {
        weekly[i].total++;
        if (a.is_correct) weekly[i].correct++;
      }
    }

    // Last 6 months
    const monthly: { label: string; key: string; total: number; correct: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      monthly.push({
        label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        total: 0,
        correct: 0,
      });
    }
    const monthIdx = new Map(monthly.map((m, i) => [m.key, i]));
    for (const a of all) {
      const d = new Date(a.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const i = monthIdx.get(k);
      if (i !== undefined) {
        monthly[i].total++;
        if (a.is_correct) monthly[i].correct++;
      }
    }

    const withAccuracy = (arr: typeof weekly) =>
      arr.map((b) => ({
        ...b,
        accuracy: b.total ? Math.round((b.correct / b.total) * 100) : 0,
      }));

    return { weekly: withAccuracy(weekly), monthly: withAccuracy(monthly) };
  });
