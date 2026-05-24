import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
});

export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ChangePasswordSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    // Get email of current user via admin
    const { data: userRes, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getErr || !userRes?.user?.email) {
      return { ok: false as const, error: "Não foi possível verificar a sessão." };
    }
    const email = userRes.user.email;

    // Re-auth using a throwaway client to validate current password
    const url = process.env.SUPABASE_URL!;
    const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const tmp = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signErr } = await tmp.auth.signInWithPassword({
      email,
      password: data.currentPassword,
    });
    if (signErr) {
      return { ok: false as const, error: "Senha atual incorreta." };
    }

    // Update password via admin
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.newPassword,
    });
    if (updErr) {
      return { ok: false as const, error: updErr.message };
    }
    return { ok: true as const };
  });

const DeleteAccountSchema = z.object({ confirmation: z.literal("EXCLUIR") });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => DeleteAccountSchema.parse(i))
  .handler(async ({ context }) => {
    const { userId, supabase } = context;

    // 1. Best-effort cleanup of user data (in case cascades are missing).
    try {
      // Files: list and remove everything under user's folder in prova-uploads
      const { data: provFiles } = await supabase.storage
        .from("prova-uploads")
        .list(userId, { limit: 1000 });
      if (provFiles && provFiles.length > 0) {
        await supabase.storage
          .from("prova-uploads")
          .remove(provFiles.map((f) => `${userId}/${f.name}`));
      }
      const { data: avFiles } = await supabase.storage
        .from("avatars")
        .list(userId, { limit: 100 });
      if (avFiles && avFiles.length > 0) {
        await supabase.storage
          .from("avatars")
          .remove(avFiles.map((f) => `${userId}/${f.name}`));
      }
    } catch {
      // ignore — proceed with deletion
    }

    // 2. Explicit deletes via admin (bypasses RLS, ensures full cleanup
    // even when FK cascades are absent on legacy tables).
    try { await supabaseAdmin.from("review_later").delete().eq("user_id", userId); } catch { /* ignore */ }
    try { await supabaseAdmin.from("favorites").delete().eq("user_id", userId); } catch { /* ignore */ }
    try { await supabaseAdmin.from("notes").delete().eq("user_id", userId); } catch { /* ignore */ }
    try { await supabaseAdmin.from("attempts").delete().eq("user_id", userId); } catch { /* ignore */ }
    // explanations + question_options are tied to questions; delete questions first then cascade may not exist
    try {
      const { data: qs } = await supabaseAdmin.from("questions").select("id").eq("user_id", userId);
      const qIds = (qs ?? []).map((q) => q.id);
      if (qIds.length > 0) {
        await supabaseAdmin.from("explanations").delete().in("question_id", qIds);
        await supabaseAdmin.from("question_options").delete().in("question_id", qIds);
      }
    } catch { /* ignore */ }
    try { await supabaseAdmin.from("questions").delete().eq("user_id", userId); } catch { /* ignore */ }
    try { await supabaseAdmin.from("uploads").delete().eq("user_id", userId); } catch { /* ignore */ }
    try { await supabaseAdmin.from("folders").delete().eq("user_id", userId); } catch { /* ignore */ }
    try { await supabaseAdmin.from("user_preferences").delete().eq("user_id", userId); } catch { /* ignore */ }
    try { await supabaseAdmin.from("profiles").delete().eq("id", userId); } catch { /* ignore */ }

    // 3. Delete the auth user (irreversible)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const };
  });
