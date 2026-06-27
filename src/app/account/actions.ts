"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey, hashApiKey } from "@/lib/api-keys";

export type CreateKeyState = { ok: boolean; key?: string; error?: string };

/**
 * Devuelve el id del scraper aprobado autenticado, o null.
 * Valida: hay sesión, rol scraper y scraper_status = approved.
 */
async function getApprovedScraperId(): Promise<string | null> {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "scraper") return null;

  const supabase = createAdminClient();
  const { data: prof } = await supabase
    .from("profiles")
    .select("scraper_status")
    .eq("id", profile.userId)
    .maybeSingle();
  if (prof?.scraper_status !== "approved") return null;

  return profile.userId;
}

export async function createApiKeyAction(
  _prev: CreateKeyState,
  formData: FormData,
): Promise<CreateKeyState> {
  const scraperId = await getApprovedScraperId();
  if (!scraperId) {
    return { ok: false, error: "Tu cuenta aún no está aprobada para crear keys." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Ponle un nombre a la key." };

  const key = generateApiKey();
  const supabase = createAdminClient();
  const { error } = await supabase.from("partner_api_keys").insert({
    owner_id: scraperId,
    name,
    key_hash: hashApiKey(key),
    active: true,
  });
  if (error) return { ok: false, error: "No se pudo crear la key." };

  revalidatePath("/account");
  return { ok: true, key };
}

export async function revokeApiKeyAction(formData: FormData) {
  const scraperId = await getApprovedScraperId();
  if (!scraperId) return;

  const keyId = String(formData.get("keyId") ?? "");
  if (!keyId) return;

  const supabase = createAdminClient();
  // Solo puede revocar SUS propias keys.
  await supabase
    .from("partner_api_keys")
    .update({ active: false })
    .eq("id", keyId)
    .eq("owner_id", scraperId);

  revalidatePath("/account");
}
