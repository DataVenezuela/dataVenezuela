"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionProfile, hasRole, ADMIN_ROLES } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";

function back(msg?: string): never {
  redirect(`/admin/sources${msg ? `?msg=${encodeURIComponent(msg)}` : ""}`);
}

async function requireAdmin(): Promise<void> {
  const profile = await getSessionProfile();
  if (!hasRole(profile, ADMIN_ROLES)) back("forbidden");
}

/** Crea una fuente, opcionalmente asignada a un scraper (owner_id). */
export async function createSourceAction(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim() || null;
  const ownerId = String(formData.get("ownerId") ?? "").trim() || null;
  const slugInput = String(formData.get("slug") ?? "").trim();
  if (!name) back("invalid");

  const slug = slugify(slugInput || name) || `fuente-${Date.now()}`;

  const supabase = createAdminClient();
  const { error } = await supabase.from("sources").insert({
    name,
    slug,
    website,
    owner_id: ownerId,
  });
  if (error) back(error.code === "23505" ? "slug-taken" : "createfailed");

  revalidatePath("/admin/sources");
  back();
}
