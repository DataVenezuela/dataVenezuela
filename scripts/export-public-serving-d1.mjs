import assert from "node:assert/strict";
import { dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const EXPORTS = [
  {
    view: "public_serving_events",
    table: "events",
    columns: [
      "event_id",
      "name",
      "event_type",
      "occurred_at",
      "affected_states",
      "magnitude",
      "depth_km",
      "status",
      "external_ids",
    ],
    schema: `
create table events (
  event_id text primary key,
  name text not null,
  event_type text not null,
  occurred_at text not null,
  affected_states text,
  magnitude real,
  depth_km real,
  status text not null,
  external_ids text
);
create index events_status_idx on events(status);
create index events_occurred_at_idx on events(occurred_at desc);`,
  },
  {
    view: "public_serving_persons",
    table: "persons",
    columns: [
      "person_record_id",
      "event_id",
      "full_name",
      "alternate_names",
      "cedula_hmac",
      "cedula_masked",
      "age_range",
      "sex",
      "last_known_location",
      "status",
      "verification_status",
      "confidence_score",
      "source_url",
    ],
    schema: `
create table persons (
  person_record_id text primary key,
  event_id text not null,
  full_name text,
  alternate_names text,
  cedula_hmac text,
  cedula_masked text,
  age_range text,
  sex text,
  last_known_location text,
  status text not null,
  verification_status text not null,
  confidence_score real not null,
  source_url text
);
create index persons_event_id_idx on persons(event_id);
create index persons_status_idx on persons(status);
create index persons_cedula_hmac_idx on persons(cedula_hmac);
create index persons_full_name_idx on persons(full_name);`,
  },
  {
    view: "public_serving_acopio_centers",
    table: "acopio_centers",
    columns: [
      "acopio_id",
      "event_id",
      "name",
      "location",
      "confidence_score",
      "status",
      "needs",
      "last_verified_at",
      "managing_org",
      "contact_masked",
      "capacity",
      "current_load",
    ],
    schema: `
create table acopio_centers (
  acopio_id text primary key,
  event_id text not null,
  name text not null,
  location text,
  confidence_score real not null,
  status text not null,
  needs text,
  last_verified_at text,
  managing_org text,
  contact_masked text,
  capacity integer,
  current_load integer
);
create index acopio_centers_event_id_idx on acopio_centers(event_id);
create index acopio_centers_status_idx on acopio_centers(status);`,
  },
];

const jsonColumns = new Set([
  "affected_states",
  "external_ids",
  "alternate_names",
  "age_range",
  "last_known_location",
  "location",
  "needs",
]);

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlValue(column, value) {
  if (value === null || value === undefined) return "null";
  if (jsonColumns.has(column)) return sqlString(JSON.stringify(value));
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "1" : "0";
  return sqlString(value);
}

function insertRows(def, rows) {
  if (rows.length === 0) return `-- ${def.table}: 0 rows`;

  const columns = def.columns.join(", ");
  return rows
    .map((row) => {
      const values = def.columns.map((column) => sqlValue(column, row[column])).join(", ");
      return `insert into ${def.table} (${columns}) values (${values});`;
    })
    .join("\n");
}

function renderD1Sql(snapshot, generatedAt = new Date().toISOString()) {
  const blocks = [
    `-- dataVenezuela public serving export\n-- generated_at: ${generatedAt}`,
    "pragma foreign_keys = off;",
    "begin transaction;",
    ...EXPORTS.map((def) => `drop table if exists ${def.table};`),
    "drop table if exists snapshot_metadata;",
    ...EXPORTS.map((def) => def.schema.trim()),
    `create table snapshot_metadata (
  key text primary key,
  value text not null
);`,
    ...EXPORTS.map((def) => insertRows(def, snapshot[def.table] ?? [])),
    `insert into snapshot_metadata (key, value) values ('generated_at', ${sqlString(generatedAt)});`,
    ...EXPORTS.map((def) => {
      const count = snapshot[def.table]?.length ?? 0;
      return `insert into snapshot_metadata (key, value) values ('${def.table}_count', '${count}');`;
    }),
    "commit;",
    "pragma foreign_keys = on;",
  ];

  return `${blocks.join("\n\n")}\n`;
}

async function fetchAll(supabase, def) {
  const pageSize = Number(process.env.PUBLIC_SERVING_PAGE_SIZE ?? 1000);
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("PUBLIC_SERVING_PAGE_SIZE debe ser un entero >= 1");
  }
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await supabase
      .from(def.view)
      .select(def.columns.join(","))
      .order(def.columns[0], { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;

    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
    from += pageSize;
  }
}

function parseArgs(argv) {
  const outIndex = argv.indexOf("--out");
  if (outIndex !== -1 && (!argv[outIndex + 1] || argv[outIndex + 1].startsWith("--"))) {
    throw new Error("Uso: npm run public-serving:export -- --out /tmp/public-serving.sql");
  }

  return {
    selfTest: argv.includes("--self-test"),
    out: outIndex === -1 ? null : argv[outIndex + 1],
  };
}

function selfTest() {
  const sql = renderD1Sql(
    {
      events: [
        {
          event_id: "e1",
          name: "Evento O'Hara",
          event_type: "earthquake",
          occurred_at: "2026-06-24T12:00:00Z",
          affected_states: ["Yaracuy"],
          magnitude: 5.4,
          depth_km: null,
          status: "active",
          external_ids: { usgs: "x" },
        },
      ],
      persons: [],
      acopio_centers: [],
    },
    "2026-06-27T00:00:00.000Z",
  );

  assert(sql.includes("Evento O''Hara"), "escapa comillas simples");
  assert(sql.includes("create table persons"), "crea tabla persons");
  for (const field of ["contact_hmac", "raw_json", "raw_text", "scraper_id", "partner_api_keys"]) {
    assert(!sql.includes(field), `no exporta ${field}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    selfTest();
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const entries = await Promise.all(
    EXPORTS.map(async (def) => [def.table, await fetchAll(supabase, def)]),
  );
  const sql = renderD1Sql(Object.fromEntries(entries));

  if (!args.out) {
    process.stdout.write(sql);
    return;
  }

  await mkdir(dirname(args.out), { recursive: true });
  await writeFile(args.out, sql);
  console.error(`Export escrito en ${args.out}`);
}

await main();
