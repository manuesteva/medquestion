import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  fullName: z.string().min(1).max(120),
});

/**
 * Create a user with email auto-confirmed so they can sign in immediately
 * after submitting the signup form.
 */
export const signupWithAutoConfirm = createServerFn({ method: "POST" })
  .inputValidator((input) => SignupSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered")) {
        return { ok: false as const, error: "Este e-mail já está cadastrado." };
      }
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const, userId: created.user?.id ?? null };
  });
