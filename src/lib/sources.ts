import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Genera un slug único para una fuente a partir de un nombre. */
export async function uniqueSourceSlug(
  supabase: AdminClient,
  name: string,
): Promise<string> {
  const base = slugify(name) || "fuente";
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const { data } = await supabase
      .from("sources")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Garantiza que `ownerId` tenga al menos una fuente propia. Si ya tiene alguna no
 * hace nada; si no, crea una con un slug único y sin website. Idempotente.
 * Útil para auto-provisionar la fuente de un admin que se registra como scraper.
 */
export async function ensureOwnerSource(
  supabase: AdminClient,
  ownerId: string,
  name: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from("sources")
    .select("id")
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  await supabase.from("sources").insert({
    name,
    slug: await uniqueSourceSlug(supabase, name),
    website: null,
    owner_id: ownerId,
  });
}
