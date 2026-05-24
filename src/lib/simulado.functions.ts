import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startSimulado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      count: z.number().int().min(1).max(500),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("questions")
      .select("id, statement, subject, question_options(id, label, text, is_correct)")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const list = (rows ?? []).map((r) => ({
      ...r,
      question_options: [...(r.question_options ?? [])].sort((a, b) => a.label.localeCompare(b.label)),
    }));
    // shuffle
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return { questions: list.slice(0, Math.min(data.count, list.length)) };
  });
