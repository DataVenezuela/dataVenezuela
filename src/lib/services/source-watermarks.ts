import { createAdminClient } from "@/lib/supabase/admin";
import { SourceOwnershipError } from "@/lib/services/aportes";

// Default cuando la fuente existe pero aún no tiene fila de watermark: el exporter
// procesa "desde el principio del tiempo".
export const WATERMARK_DEFAULT = "1970-01-01T00:00:00Z";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Valida que la fuente `slug` exista y pertenezca al scraper autenticado.
 * Mismo patrón de ownership que `createAporte` (sources.owner_id = scraperId).
 */
async function assertOwnedSource(
  supabase: Admin,
  slug: string,
  scraperId: string,
): Promise<void> {
  const { data } = await supabase
    .from("sources")
    .select("slug")
    .eq("owner_id", scraperId)
    .eq("slug", slug)
    .maybeSingle();
  if (!data) throw new SourceOwnershipError();
}

/**
 * Lee el watermark de una fuente propia. Si la fuente existe pero no tiene fila,
 * devuelve el default `1970-01-01T00:00:00Z`. Fuente ajena/inexistente → 403.
 */
export async function getWatermark(
  slug: string,
  { scraperId }: { scraperId: string },
): Promise<string> {
  const supabase = createAdminClient();
  await assertOwnedSource(supabase, slug, scraperId);

  const { data } = await supabase
    .from("source_watermarks")
    .select("watermark_at")
    .eq("source_slug", slug)
    .maybeSingle();

  return data?.watermark_at ?? WATERMARK_DEFAULT;
}

/**
 * Upsert del watermark de una fuente propia. Devuelve el valor guardado.
 * Fuente ajena/inexistente → 403.
 */
export async function setWatermark(
  slug: string,
  watermarkAt: string,
  { scraperId }: { scraperId: string },
): Promise<string> {
  const supabase = createAdminClient();
  await assertOwnedSource(supabase, slug, scraperId);

  const { data, error } = await supabase
    .from("source_watermarks")
    .upsert(
      {
        source_slug: slug,
        watermark_at: watermarkAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_slug" },
    )
    .select("watermark_at")
    .single();

  if (error) throw new Error(`setWatermark failed: ${error.message}`);
  return data.watermark_at;
}
