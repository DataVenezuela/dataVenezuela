// Verificación E2E de la ingesta de aportes y la lectura pública.
// Requiere: `npm run seed` ejecutado y el servidor dev corriendo.
//   APP_URL (def. http://localhost:3000) apunta al servidor Next.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const DEMO_KEY = "demo-scraper-key";

if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ok = (cond) => (cond ? "✓" : "✗ FALLA");
let failures = 0;
const check = (label, cond) => {
  if (!cond) failures++;
  console.log(`${ok(cond)} ${label}`);
};

// source_id del scraper demo (vía service role).
const { data: source } = await admin
  .from("sources")
  .select("id")
  .eq("slug", "scraper-demo")
  .maybeSingle();
if (!source) {
  console.error("No existe la fuente 'scraper-demo'. ¿Corriste `npm run seed`?");
  process.exit(1);
}
const sourceId = source.id;

const post = (body, headers = {}) =>
  fetch(`${appUrl}/api/aportes`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const externalId = `e2e-${Date.now()}`;

// 1. POST con key válida → 201 received
const r1 = await post(
  { sourceId, externalId, rawJson: { hola: "mundo" } },
  { "x-api-key": DEMO_KEY },
);
const b1 = await r1.json();
check(`POST aporte nuevo → 201 (${r1.status})`, r1.status === 201 && b1.duplicate === false);

// 2. POST idéntico → 200 duplicate
const r2 = await post(
  { sourceId, externalId, rawJson: { hola: "mundo" } },
  { "x-api-key": DEMO_KEY },
);
const b2 = await r2.json();
check(`POST duplicado → 200 duplicate (${r2.status})`, r2.status === 200 && b2.duplicate === true);
check("duplicado devuelve el mismo id", b1.id && b1.id === b2.id);

// 3. POST sin key → 401
const r3 = await post({ sourceId, externalId: "x", rawText: "y" });
check(`POST sin key → 401 (${r3.status})`, r3.status === 401);

// 4. POST con fuente ajena (uuid inexistente) → 403
const r4 = await post(
  { sourceId: "00000000-0000-0000-0000-000000000000", externalId: "z", rawText: "y" },
  { "x-api-key": DEMO_KEY },
);
check(`POST con fuente ajena → 403 (${r4.status})`, r4.status === 403);

// 5. POST sin payload (ni json ni texto) → 422
const r5 = await post({ sourceId, externalId: "no-payload" }, { "x-api-key": DEMO_KEY });
check(`POST sin payload → 422 (${r5.status})`, r5.status === 422);

// 5b. POST identificando la fuente por SLUG (no por id) → 201
const r5b = await post(
  { sourceSlug: "scraper-demo", externalId: `e2e-slug-${Date.now()}`, rawText: "via slug" },
  { "x-api-key": DEMO_KEY },
);
const b5b = await r5b.json();
check(`POST con sourceSlug → 201 (${r5b.status})`, r5b.status === 201 && b5b.duplicate === false);

// 5c. POST sin fuente (ni id ni slug) → 422
const r5c = await post({ externalId: "no-source", rawText: "y" }, { "x-api-key": DEMO_KEY });
check(`POST sin fuente → 422 (${r5c.status})`, r5c.status === 422);

// 6. GET público lista (sin key) → 200 e incluye el aporte creado
const r6 = await fetch(`${appUrl}/api/aportes?external_id=${externalId}`);
const b6 = await r6.json();
check(`GET público lista → 200 (${r6.status})`, r6.status === 200);
check("GET lista incluye el aporte creado", (b6.aportes ?? []).some((a) => a.id === b1.id));

// 7. GET público por id (sin key) → 200
const r7 = await fetch(`${appUrl}/api/aportes/${b1.id}`);
const b7 = await r7.json();
check(`GET público por id → 200 (${r7.status})`, r7.status === 200 && b7.aporte?.id === b1.id);
check("la lectura pública NO expone scraper_id", b7.aporte && !("scraper_id" in b7.aporte));

console.log(failures === 0 ? "\nTodo verde." : `\n${failures} fallo(s).`);
process.exit(failures === 0 ? 0 : 1);
