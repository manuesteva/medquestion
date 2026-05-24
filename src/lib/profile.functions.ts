import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: prefs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    return { profile, prefs };
  });

const Gender = z.enum(["female", "male", "neutral"]);

const PrefsSchema = z.object({
  goal: z.string().min(1).max(64),
  specialty: z.string().min(1).max(64),
  daily_goal: z.number().int().min(5).max(500),
  theme: z.enum(["light", "dark"]),
  gender: Gender,
  full_name: z.string().min(1).max(120).optional(),
});

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PrefsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error: pErr } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: userId,
        goal: data.goal,
        specialty: data.specialty,
        daily_goal: data.daily_goal,
      });
    if (pErr) throw new Error(pErr.message);

    const profileRow: { id: string; onboarded: boolean; theme: string; gender: string; full_name?: string } = {
      id: userId,
      onboarded: true,
      theme: data.theme,
      gender: data.gender,
    };
    if (data.full_name) profileRow.full_name = data.full_name;
    const { error: profErr } = await supabase
      .from("profiles")
      .upsert(profileRow, { onConflict: "id" });
    if (profErr) throw new Error(profErr.message);
    return { ok: true as const };
  });

export const updateTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ theme: z.enum(["light", "dark"]) }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ theme: data.theme })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateGender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ gender: Gender }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ gender: data.gender })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateDailyGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ daily_goal: z.number().int().min(5).max(500) }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_preferences")
      .upsert({ user_id: context.userId, daily_goal: data.daily_goal });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateFullName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ full_name: z.string().trim().min(1).max(120) }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.full_name })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateAvatarUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ avatar_url: z.string().url().max(500).nullable() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ avatar_url: data.avatar_url })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
