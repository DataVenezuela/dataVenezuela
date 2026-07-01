// CLI de ingesta de datasets tabulares -> tabla `sources`.
// Contrato pensado para agentes de IA: JSON de entrada, JSON de salida.
//
//   node --env-file=.env.local scripts/import-dataset.mjs <request.json>
//   echo '{...}' | node --env-file=.env.local scripts/import-dataset.mjs
//
// request.json (entrada):
//   {
//     "file": "data/Páginas de ayuda - Sheet1.csv",  // ruta al CSV/JSON
//     "format": "csv",                                 // "csv" (def) | "json"
//     "ownerId": "uuid",                               // opcional; owner_id (null = del sistema)
//     "dryRun": true,                                  // opcional; def false
//     "includeUnselected": false                       // opcional; importar filas FALSE
//   }
//
// Salida: el reporte JSON (ver src/lib/import/dataset.mjs) por stdout.
// Resumen humano por stderr. Código de salida 1 si ok=false.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { importDataset } from "../src/lib/import/dataset.mjs";

function readRequest() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("-"));
  const raw = arg ? readFileSync(arg, "utf8") : readFileSync(0, "utf8"); // 0 = stdin
  return JSON.parse(raw);
}

function makeStore(supabase) {
  return {
    async findBySlug(slug) {
      const { data } = await supabase
        .from("sources")
        .select("id, name, website")
        .eq("slug", slug)
        .maybeSingle();
      return data ? { id: data.id, name: data.name, website: data.website } : null;
    },
    async insert(rec) {
      const { data, error } = await supabase
        .from("sources")
        .insert({
          name: rec.name,
          slug: rec.slug,
          website: rec.website,
          owner_id: rec.ownerId,
        })
        .select("id")
        .single();
      // 23505 = otra ejecución insertó el mismo slug: idempotente.
      if (error && error.code !== "23505") throw new Error(error.message);
      return { id: data?.id ?? "" };
    },
    async update(id, patch) {
      const { error } = await supabase
        .from("sources")
        .update({ name: patch.name, website: patch.website })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}

const request = readRequest();
const content = readFileSync(request.file, "utf8");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const report = await importDataset({ ...request, content }, makeStore(supabase));

process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (report.ok) {
  const s = report.summary;
  console.error(
    `${report.dryRun ? "[dry-run] " : ""}procesadas=${s.processed} insertadas=${s.inserted} ` +
      `actualizadas=${s.updated} omitidas=${s.skipped} rechazadas=${s.rejected}`,
  );
}
process.exit(report.ok ? 0 : 1);
