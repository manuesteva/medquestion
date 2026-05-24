import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NameSchema = z.string().trim().min(1).max(60);
const ColorSchema = z.enum(["blue", "violet", "emerald", "amber", "rose", "slate"]);

export const listFolders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: folders }, { data: ups }] = await Promise.all([
      supabase
        .from("folders")
        .select("id, name, color, position, created_at")
        .eq("user_id", userId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("uploads").select("folder_id").eq("user_id", userId),
    ]);
    const counts = new Map<string | null, number>();
    for (const u of ups ?? []) {
      const k = u.folder_id ?? null;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return {
      folders: (folders ?? []).map((f) => ({ ...f, count: counts.get(f.id) ?? 0 })),
      unfiledCount: counts.get(null) ?? 0,
      totalCount: (ups ?? []).length,
    };
  });

export const createFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ name: NameSchema, color: ColorSchema.default("blue") }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("folders")
      .select("position")
      .eq("user_id", userId)
      .order("position", { ascending: false })
      .limit(1);
    const nextPos = (existing?.[0]?.position ?? -1) + 1;
    const { data: row, error } = await supabase
      .from("folders")
      .insert({ user_id: userId, name: data.name, color: data.color, position: nextPos })
      .select("id, name, color, position")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), name: NameSchema.optional(), color: ColorSchema.optional() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const patch: { name?: string; color?: string } = {};
    if (data.name) patch.name = data.name;
    if (data.color) patch.color = data.color;
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await context.supabase
      .from("folders")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    // FK ON DELETE SET NULL will move uploads to "Sem pasta"
    const { error } = await context.supabase
      .from("folders")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const moveUploadToFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ uploadId: z.string().uuid(), folderId: z.string().uuid().nullable() })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("uploads")
      .update({ folder_id: data.folderId })
      .eq("id", data.uploadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const reorderFolders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ids: z.array(z.string().uuid()).max(100) }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await Promise.all(
      data.ids.map((id, idx) =>
        supabase.from("folders").update({ position: idx }).eq("id", id).eq("user_id", userId),
      ),
    );
    return { ok: true as const };
  });
