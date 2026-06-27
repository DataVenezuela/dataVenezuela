import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import { formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createAdminClient();

  const { count: aportesCount } = await supabase
    .from("aportes")
    .select("id", { count: "exact", head: true });

  const { data: recent } = await supabase
    .from("aportes")
    .select("id, external_id, source_id, created_at, sources(name)")
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight">dataVenezuela</h1>
      <p className="mt-4 max-w-2xl text-lg text-gray-600">
        Plataforma de ingesta de datos. Los scrapers suben aportes por API,
        atribuidos a una fuente. Los datos se guardan en bruto (JSON + texto) para
        adaptarse a cualquier tipo de información; la verificación llega después.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/sources" className={btnPrimary}>
          Fuentes de datos
        </Link>
        <Link href="/register" className={btnSecondary}>
          Registrarme como scraper
        </Link>
        <Link href="/docs" className={btnSecondary}>
          Documentación de la API
        </Link>
        <Link href="/account" className={btnSecondary}>
          Mi cuenta / API keys
        </Link>
        <Link href="/admin" className={btnSecondary}>
          Panel interno
        </Link>
      </div>

      {/* Aportes recientes */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Aportes recientes</h2>
          <span className="text-sm text-gray-500">
            {aportesCount ?? 0} en total
          </span>
        </div>

        {(recent ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Aún no hay aportes.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(recent ?? []).map((a) => {
              const source = a.sources as { name: string } | null;
              return (
                <div
                  key={a.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <p className="font-medium">{source?.name ?? "Fuente —"}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {a.external_id ? `ext: ${a.external_id} · ` : ""}
                    {formatDate(a.created_at)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* API */}
      <section className="mt-12 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold">API</h2>
        <ul className="mt-2 space-y-1 text-sm text-gray-600">
          <li>
            <code>POST /api/aportes</code> — ingesta (header{" "}
            <code>x-api-key</code>; cuerpo con <code>source_id</code>,{" "}
            <code>external_id</code>, <code>raw_json</code>/<code>raw_text</code>).
          </li>
          <li>
            <code>GET /api/aportes</code> y <code>GET /api/aportes/:id</code> —
            lectura pública.
          </li>
        </ul>
      </section>
    </main>
  );
}
