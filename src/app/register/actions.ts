"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

function fail(msg: string): never {
  redirect(`/register?status=error&msg=${encodeURIComponent(msg)}`);
}

/**
 * Registro de scraper/cleaner. Crea el usuario, marca el perfil como
 * `pending` y guarda una solicitud (scraper_applications) que un superusuario
 * (admin) debe aprobar antes de que pueda generar API keys.
 */
export async function registerScraperAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const sourceName = String(formData.get("sourceName") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim() || null;
  const socialUrl = String(formData.get("socialUrl") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!email || !password || !fullName || !sourceName) {
    fail("Faltan campos obligatorios.");
  }
  if (password.length < 8) {
    fail("La contraseña debe tener al menos 8 caracteres.");
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    fail(
      error?.message?.toLowerCase().includes("already")
        ? "Ese correo ya está registrado."
        : "No se pudo crear la cuenta.",
    );
  }

  const userId = data.user.id;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: fullName, scraper_status: "pending" })
    .eq("id", userId);
  if (profileError) fail("No se pudo preparar el perfil.");

  const { error: appError } = await supabase
    .from("scraper_applications")
    .insert({
      profile_id: userId,
      source_name: sourceName,
      website,
      social_url: socialUrl,
      description,
    });
  if (appError) fail("No se pudo registrar la solicitud.");

  redirect("/login?registered=1");
}
