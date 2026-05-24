import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const globalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ query: z.string().trim().min(1).max(120) }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const q = data.query.replace(/[%_]/g, "\\$&");
    const like = `%${q}%`;

    const [uploadsRes, questionsRes, notesRes] = await Promise.all([
      supabase
        .from("uploads")
        .select("id, display_name, file_name, created_at")
        .eq("user_id", userId)
        .or(`display_name.ilike.${like},file_name.ilike.${like}`)
        .limit(8),
      supabase
        .from("questions")
        .select("id, statement, subject, upload_id")
        .eq("user_id", userId)
        .or(`statement.ilike.${like},subject.ilike.${like}`)
        .limit(12),
      supabase
        .from("notes")
        .select("question_id, body, updated_at")
        .eq("user_id", userId)
        .ilike("body", like)
        .limit(6),
    ]);

    return {
      uploads: uploadsRes.data ?? [],
      questions: questionsRes.data ?? [],
      notes: notesRes.data ?? [],
    };
  });
