import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const supabase = createAdminClient();
  // Solo columnas públicas.
  const { data: sources } = await supabase
    .from("sources")
    .select("id, name, slug, website")
    .order("name", { ascending: true });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← Inicio
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Fuentes de datos</h1>
      <p className="mt-1 text-sm text-gray-600">
        Scrapers y aliados que aportan información a la plataforma.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(sources ?? []).length === 0 && (
          <p className="text-sm text-gray-500">Aún no hay fuentes registradas.</p>
        )}
        {(sources ?? []).map((s) => (
          <article
            key={s.id}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold">{s.name}</h2>
            <p className="mt-0.5 text-xs text-gray-400">{s.slug}</p>
            <div className="mt-3 text-sm">
              {s.website ? (
                <a
                  href={s.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  🌐 {s.website}
                </a>
              ) : (
                <span className="text-xs text-gray-400">Sin enlace público.</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
