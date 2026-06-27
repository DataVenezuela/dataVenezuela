// Datos de demostración para desarrollo. Ejecutar con:  npm run seed
// (carga .env.local; necesita auth + la sal de hashing).
//
// Crea:
//  * admin
//  * scraper APROBADO con su fuente, una API key demo y aportes de ejemplo
//  * scraper PENDIENTE (para probar el flujo de aprobación en /admin/users)
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const salt = process.env.PARTNER_API_SALT ?? "";

if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const hashApiKey = (key) =>
  createHash("sha256").update(`${key}${salt}`).digest("hex");

/** Crea (o reutiliza) un usuario de Auth y devuelve su id. */
async function ensureUser({ email, password, full_name }) {
  const { data: list } = await supabase.auth.admin.listUsers();
  let user = list?.users?.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (error) throw error;
    user = data.user;
    console.log(`✓ usuario creado: ${email}`);
  } else {
    console.log(`· usuario ya existe: ${email}`);
  }
  return user.id;
}

async function seedAdmin() {
  const id = await ensureUser({
    email: "admin@datavenezuela.local",
    password: "Admin12345!",
    full_name: "Admin",
  });
  await supabase
    .from("profiles")
    .update({ role: "admin", full_name: "Admin" })
    .eq("id", id);
  console.log("  rol = admin");
}

async function seedApprovedScraper() {
  const id = await ensureUser({
    email: "scraper@datavenezuela.local",
    password: "Scraper12345!",
    full_name: "Scraper Demo",
  });
  await supabase
    .from("profiles")
    .update({ role: "scraper", scraper_status: "approved", full_name: "Scraper Demo" })
    .eq("id", id);

  // Fuente del scraper (slug estable para reusar).
  let { data: source } = await supabase
    .from("sources")
    .select("id")
    .eq("slug", "scraper-demo")
    .maybeSingle();
  if (!source) {
    const { data, error } = await supabase
      .from("sources")
      .insert({
        name: "Scraper Demo",
        slug: "scraper-demo",
        website: "https://example.org",
        owner_id: id,
      })
      .select("id")
      .single();
    if (error) throw error;
    source = data;
  }
  const sourceId = source.id;

  // API key demo (la key en claro solo existe aquí; se guarda el hash).
  const DEMO_KEY = "demo-scraper-key";
  const { error: keyErr } = await supabase
    .from("partner_api_keys")
    .upsert(
      { owner_id: id, name: "Scraper demo", key_hash: hashApiKey(DEMO_KEY), active: true },
      { onConflict: "key_hash" },
    );
  if (keyErr) throw keyErr;

  // Aportes de ejemplo (uno con raw_json, otro con raw_text). Idempotentes por external_id.
  const examples = [
    {
      external_id: "demo-001",
      raw_json: { titulo: "Centro de acopio en Chacao", ciudad: "Caracas", tipo: "punto_ayuda" },
      raw_text: null,
    },
    {
      external_id: "demo-002",
      raw_json: null,
      raw_text: "Familia necesita insulina refrigerada en Maracaibo, sector Santa Rosa.",
    },
  ];
  for (const ex of examples) {
    const { data: existing } = await supabase
      .from("aportes")
      .select("id")
      .eq("scraper_id", id)
      .eq("external_id", ex.external_id)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase
        .from("aportes")
        .insert({ ...ex, source_id: sourceId, scraper_id: id });
      if (error) throw error;
    }
  }

  console.log(`✓ scraper aprobado listo. source_id=${sourceId} · x-api-key: ${DEMO_KEY}`);
}

async function seedPendingScraper() {
  const email = "scraper-pending@datavenezuela.local";
  const id = await ensureUser({
    email,
    password: "Scraper12345!",
    full_name: "Scraper Pendiente",
  });
  await supabase
    .from("profiles")
    .update({ full_name: "Scraper Pendiente", scraper_status: "pending" })
    .eq("id", id);

  const { data: existingApp } = await supabase
    .from("scraper_applications")
    .select("id")
    .eq("profile_id", id)
    .maybeSingle();
  if (!existingApp) {
    const { error } = await supabase.from("scraper_applications").insert({
      profile_id: id,
      source_name: "Scraper Inundaciones",
      website: "https://example.org",
      description: "Recolecta reportes de inundaciones de redes sociales.",
    });
    if (error) throw error;
  }
  console.log("  solicitud de scraper = pending");
}

await seedAdmin();
await seedApprovedScraper();
await seedPendingScraper();
console.log("\nSeed completado.");
process.exit(0);
