import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/api-keys";

export type Partner = {
  apiKeyId: string;
  scraperId: string; // owner_id de la key = el scraper que sube los datos
  name: string;
};

/**
 * Autentica un scraper por el header `x-api-key`. Devuelve el scraper o null.
 * Compara contra partner_api_keys.key_hash y actualiza last_used_at.
 */
export async function authenticatePartner(
  request: Request,
): Promise<Partner | null> {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("partner_api_keys")
    .select("id, owner_id, name, active")
    .eq("key_hash", hashApiKey(apiKey))
    .maybeSingle();

  if (!data || !data.active || !data.owner_id) return null;

  await supabase
    .from("partner_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { apiKeyId: data.id, scraperId: data.owner_id, name: data.name };
}
