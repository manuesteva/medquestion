import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Filters = z.object({
  specialty: z.string().nullable().optional(),
  onlyFavorites: z.boolean().optional(),
  onlyWrong: z.boolean().optional(),
  onlyUnanswered: z.boolean().optional(),
  onlyReviewLater: z.boolean().optional(),
  uploadIds: z.array(z.string().uuid()).optional(),
  limit: z.number().int().min(1).max(200).default(30),
});

export const listQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Filters.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    let questionIds: string[] | null = null;

    if (data.onlyFavorites) {
      const { data: favs } = await supabase
        .from("favorites")
        .select("question_id")
        .eq("user_id", userId);
      questionIds = (favs ?? []).map((f) => f.question_id);
      if (questionIds.length === 0) return { questions: [] };
    }

    if (data.onlyReviewLater) {
      const { data: rl } = await supabase
        .from("review_later")
        .select("question_id")
        .eq("user_id", userId);
      const setIds = new Set((rl ?? []).map((a) => a.question_id));
      questionIds = questionIds
        ? questionIds.filter((id) => setIds.has(id))
        : Array.from(setIds);
      if (questionIds.length === 0) return { questions: [] };
    }

    if (data.onlyWrong) {
      const { data: wrong } = await supabase
        .from("attempts")
        .select("question_id")
        .eq("user_id", userId)
        .eq("is_correct", false);
      const setIds = new Set((wrong ?? []).map((a) => a.question_id));
      questionIds = questionIds
        ? questionIds.filter((id) => setIds.has(id))
        : Array.from(setIds);
      if (questionIds.length === 0) return { questions: [] };
    }

    if (data.onlyUnanswered) {
      const { data: answered } = await supabase
        .from("attempts")
        .select("question_id")
        .eq("user_id", userId);
      const answeredSet = new Set((answered ?? []).map((a) => a.question_id));
      // we'll filter after fetching candidates
      const { data: rows } = await supabase
        .from("questions")
        .select("id")
        .eq("user_id", userId);
      const unanswered = (rows ?? []).map((r) => r.id).filter((id) => !answeredSet.has(id));
      questionIds = questionIds ? questionIds.filter((id) => unanswered.includes(id)) : unanswered;
      if (questionIds.length === 0) return { questions: [] };
    }

    let q = supabase
      .from("questions")
      .select("id, statement, subject, difficulty, upload_id, question_options(id, label, text, is_correct)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.specialty) q = q.eq("subject", data.specialty);
    if (data.uploadIds && data.uploadIds.length > 0) q = q.in("upload_id", data.uploadIds);
    if (questionIds) q = q.in("id", questionIds);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return {
      questions: (rows ?? []).map((r) => ({
        ...r,
        question_options: [...(r.question_options ?? [])].sort((a, b) =>
          a.label.localeCompare(b.label),
        ),
      })),
    };
  });

export const recordAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        questionId: z.string().uuid(),
        optionId: z.string().uuid(),
        timeMs: z.number().int().min(0).max(60 * 60 * 1000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: opt, error } = await supabase
      .from("question_options")
      .select("is_correct, question_id")
      .eq("id", data.optionId)
      .single();
    if (error || !opt) throw new Error("Opção inválida");
    if (opt.question_id !== data.questionId) throw new Error("Opção não pertence à questão");

    const { error: insErr } = await supabase.from("attempts").insert({
      user_id: userId,
      question_id: data.questionId,
      selected_option_id: data.optionId,
      is_correct: opt.is_correct,
      time_ms: data.timeMs,
    });
    if (insErr) throw new Error(insErr.message);
    return { is_correct: opt.is_correct };
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ questionId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("favorites")
      .select("question_id")
      .eq("user_id", userId)
      .eq("question_id", data.questionId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", userId)
        .eq("question_id", data.questionId);
      return { favorited: false };
    }
    await supabase.from("favorites").insert({ user_id: userId, question_id: data.questionId });
    return { favorited: true };
  });

export const getFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("favorites")
      .select("question_id")
      .eq("user_id", context.userId);
    return new Set((data ?? []).map((d) => d.question_id));
  });

export const saveNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ questionId: z.string().uuid(), body: z.string().max(4000) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("notes")
      .upsert(
        { user_id: context.userId, question_id: data.questionId, body: data.body },
        { onConflict: "user_id,question_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ questionId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: row } = await context.supabase
      .from("notes")
      .select("body")
      .eq("user_id", context.userId)
      .eq("question_id", data.questionId)
      .maybeSingle();
    return row?.body ?? "";
  });

export const listUploads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("uploads")
      .select("id, file_name, display_name, status, error, questions_count, warnings, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });

/** Library view: every upload with computed performance. */
export const listUploadsWithStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: ups }, { data: qs }, { data: ats }] = await Promise.all([
      supabase
        .from("uploads")
        .select("id, file_name, display_name, status, error, questions_count, created_at, folder_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("questions").select("id, upload_id").eq("user_id", userId),
      supabase
        .from("attempts")
        .select("question_id, is_correct, created_at")
        .eq("user_id", userId),
    ]);

    const qToUpload = new Map<string, string>();
    for (const q of qs ?? []) if (q.upload_id) qToUpload.set(q.id, q.upload_id);

    const perUpload = new Map<
      string,
      { answered: Set<string>; correct: number; total: number; lastAt: string | null }
    >();
    for (const a of ats ?? []) {
      const up = qToUpload.get(a.question_id);
      if (!up) continue;
      const cur = perUpload.get(up) ?? { answered: new Set(), correct: 0, total: 0, lastAt: null };
      cur.answered.add(a.question_id);
      cur.total++;
      if (a.is_correct) cur.correct++;
      if (!cur.lastAt || a.created_at > cur.lastAt) cur.lastAt = a.created_at;
      perUpload.set(up, cur);
    }

    return (ups ?? []).map((u) => {
      const s = perUpload.get(u.id);
      const answeredCount = s?.answered.size ?? 0;
      const accuracy = s && s.total ? Math.round((s.correct / s.total) * 100) : 0;
      const progress = u.questions_count
        ? Math.min(100, Math.round((answeredCount / u.questions_count) * 100))
        : 0;
      return {
        ...u,
        answered: answeredCount,
        accuracy,
        progress,
        lastStudiedAt: s?.lastAt ?? null,
      };
    });
  });

export const renameUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        uploadId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("uploads")
      .update({ display_name: data.name })
      .eq("id", data.uploadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ uploadId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Fetch the upload row to get the storage path (and verify ownership).
    const { data: row, error: fetchErr } = await supabase
      .from("uploads")
      .select("id, file_path")
      .eq("id", data.uploadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Prova não encontrada");

    // Delete the upload row — cascade removes questions, options, attempts,
    // favorites, notes and explanations.
    const { error: delErr } = await supabase
      .from("uploads")
      .delete()
      .eq("id", data.uploadId)
      .eq("user_id", userId);
    if (delErr) throw new Error(delErr.message);

    // Remove the stored file (best-effort).
    if (row.file_path) {
      await supabase.storage.from("prova-uploads").remove([row.file_path]);
    }

    return { ok: true as const };
  });

export const toggleReviewLater = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ questionId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("review_later")
      .select("question_id")
      .eq("user_id", userId)
      .eq("question_id", data.questionId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("review_later")
        .delete()
        .eq("user_id", userId)
        .eq("question_id", data.questionId);
      return { marked: false };
    }
    await supabase.from("review_later").insert({ user_id: userId, question_id: data.questionId });
    return { marked: true };
  });

export const getReviewLaterIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("review_later")
      .select("question_id")
      .eq("user_id", context.userId);
    return new Set((data ?? []).map((d) => d.question_id));
  });
