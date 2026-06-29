"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionProfile, hasRole, ADMIN_ROLES, type Role } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { uniqueSourceSlug } from "@/lib/sources";

const ASSIGNABLE_ROLES: Role[] = ["public_submitter", "scraper", "admin"];

function back(msg?: string): never {
  redirect(`/admin/users${msg ? `?msg=${encodeURIComponent(msg)}` : ""}`);
}

async function requireAdminId(): Promise<string> {
  const profile = await getSessionProfile();
  if (!hasRole(profile, ADMIN_ROLES)) back("forbidden");
  return profile!.userId;
}

/** Aprueba un scraper: lo asciende a rol scraper y le crea su fuente. */
export async function approveScraperAction(formData: FormData) {
  const adminId = await requireAdminId();
  const applicationId = String(formData.get("applicationId") ?? "");
  if (!applicationId) back("invalid");

  const supabase = createAdminClient();
  const { data: app } = await supabase
    .from("scraper_applications")
    .select("id, profile_id, source_name, website, status")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) back("notfound");

  // Perfil → rol scraper aprobado.
  await supabase
    .from("profiles")
    .update({ role: "scraper", scraper_status: "approved" })
    .eq("id", app.profile_id);

  // Crea la primera fuente del scraper si aún no tiene ninguna.
  const { data: existing } = await supabase
    .from("sources")
    .select("id")
    .eq("owner_id", app.profile_id)
    .limit(1)
    .maybeSingle();
  if (!existing) {
    await supabase.from("sources").insert({
      name: app.source_name,
      slug: await uniqueSourceSlug(supabase, app.source_name),
      website: app.website,
      owner_id: app.profile_id,
    });
  }

  await supabase
    .from("scraper_applications")
    .update({
      status: "approved",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  revalidatePath("/admin/users");
  back();
}

export async function rejectScraperAction(formData: FormData) {
  const adminId = await requireAdminId();
  const applicationId = String(formData.get("applicationId") ?? "");
  if (!applicationId) back("invalid");

  const supabase = createAdminClient();
  const { data: app } = await supabase
    .from("scraper_applications")
    .select("profile_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) back("notfound");

  await supabase
    .from("profiles")
    .update({ scraper_status: "rejected" })
    .eq("id", app.profile_id);

  await supabase
    .from("scraper_applications")
    .update({
      status: "rejected",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  revalidatePath("/admin/users");
  back();
}

/** Cambia el rol de un usuario existente. */
export async function changeRoleAction(formData: FormData) {
  await requireAdminId();
  const profileId = String(formData.get("profileId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  if (!profileId || !ASSIGNABLE_ROLES.includes(role)) back("invalid");

  const supabase = createAdminClient();
  await supabase.from("profiles").update({ role }).eq("id", profileId);

  revalidatePath("/admin/users");
  back();
}

/** Crea manualmente un verificador (u otro rol de staff). */
export async function createUserAction(formData: FormData) {
  await requireAdminId();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "admin") as Role;
  if (!email || password.length < 8 || !ASSIGNABLE_ROLES.includes(role)) {
    back("invalid");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) back("createfailed");

  await supabase
    .from("profiles")
    .update({ role, full_name: fullName })
    .eq("id", data.user.id);

  revalidatePath("/admin/users");
  back();
}
