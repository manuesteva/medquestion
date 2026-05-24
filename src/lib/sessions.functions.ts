import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Kind = z.enum(["simulado", "practice", "review"]);

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        kind: Kind,
        questionIds: z.array(z.string().uuid()).min(1).max(500),
        timeLimitSec: z.number().int().min(1).max(60 * 60 * 12).nullable().optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Finalize any other active/paused session of the same kind so there's
    // always at most one resumable session per kind.
    await supabase
      .from("study_sessions")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("kind", data.kind)
      .in("status", ["active", "paused"]);

    const { data: row, error } = await supabase
      .from("study_sessions")
      .insert({
        user_id: userId,
        kind: data.kind,
        status: "active",
        question_ids: data.questionIds,
        time_limit_sec: data.timeLimitSec ?? null,
        meta: (data.meta ?? {}) as never,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Falha ao criar sessão");
    return { id: row.id as string };
  });

export const updateSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        picks: z.record(z.string(), z.string()).optional(),
        currentIndex: z.number().int().min(0).max(1000).optional(),
        elapsedSec: z.number().int().min(0).max(60 * 60 * 24).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const patch: {
      last_activity_at: string;
      picks?: Record<string, string>;
      current_index?: number;
      elapsed_sec?: number;
    } = { last_activity_at: new Date().toISOString() };
    if (data.picks) patch.picks = data.picks;
    if (data.currentIndex !== undefined) patch.current_index = data.currentIndex;
    if (data.elapsedSec !== undefined) patch.elapsed_sec = data.elapsedSec;
    const { error } = await context.supabase
      .from("study_sessions")
      .update(patch as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const pauseSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("study_sessions")
      .update({ status: "paused", last_activity_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const finishSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), correctCount: z.number().int().min(0).max(1000).optional() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const patch: Record<string, unknown> = {
      status: "finished",
      finished_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };
    if (data.correctCount !== undefined) patch.correct_count = data.correctCount;
    const { error } = await context.supabase
      .from("study_sessions")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getActiveSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ kind: Kind.optional() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "paused"])
      .order("last_activity_at", { ascending: false })
      .limit(1);
    if (data.kind) q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

export const getSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("study_sessions")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("study_sessions")
      .select("id, kind, status, question_ids, current_index, elapsed_sec, time_limit_sec, correct_count, last_activity_at, created_at, finished_at")
      .eq("user_id", context.userId)
      .order("last_activity_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("study_sessions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
