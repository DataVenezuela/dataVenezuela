import { getSessionProfile, hasRole, ADMIN_ROLES } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/labels";
import { input, label, btnPrimary, card } from "@/lib/ui";
import { createSourceAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SourcesAdminPage() {
  const profile = await getSessionProfile();
  if (!hasRole(profile, ADMIN_ROLES)) {
    return (
      <main className="max-w-lg">
        <h1 className="text-xl font-bold">Sin acceso</h1>
        <p className="mt-2 text-sm text-gray-600">
          Solo un superusuario puede gestionar fuentes.
        </p>
      </main>
    );
  }

  const supabase = createAdminClient();

  const { data: sources } = await supabase
    .from("sources")
    .select("id, name, slug, website, owner_id, created_at, profiles:owner_id(email)")
    .order("created_at", { ascending: false });

  // Scrapers a los que se les puede asignar una fuente.
  const { data: scrapers } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("role", "scraper")
    .eq("scraper_status", "approved")
    .order("email", { ascending: true });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Fuentes</h1>
        <p className="mt-1 text-sm text-gray-600">
          Crea fuentes y asígnalas a un scraper. El scraper usará el{" "}
          <code>id</code> de la fuente como <code>source_id</code> al subir
          aportes.
        </p>
      </div>

      {/* Crear fuente */}
      <section className={card}>
        <h2 className="font-semibold">Nueva fuente</h2>
        <form
          action={createSourceAction}
          className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div>
            <label className={label} htmlFor="name">Nombre *</label>
            <input id="name" name="name" required className={input} />
          </div>
          <div>
            <label className={label} htmlFor="slug">Slug (opcional)</label>
            <input id="slug" name="slug" placeholder="se genera del nombre" className={input} />
          </div>
          <div>
            <label className={label} htmlFor="website">Sitio web</label>
            <input id="website" name="website" type="url" placeholder="https://..." className={input} />
          </div>
          <div>
            <label className={label} htmlFor="ownerId">Dueño (scraper)</label>
            <select id="ownerId" name="ownerId" defaultValue="" className={input}>
              <option value="">— Del sistema (sin dueño) —</option>
              {(scrapers ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name ? `${s.full_name} · ` : ""}{s.email}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button className={btnPrimary}>Crear fuente</button>
          </div>
        </form>
      </section>

      {/* Lista de fuentes */}
      <section className={card}>
        <h2 className="font-semibold">Todas las fuentes</h2>
        <div className="mt-3 space-y-2">
          {(sources ?? []).length === 0 && (
            <p className="text-sm text-gray-500">Aún no hay fuentes.</p>
          )}
          {(sources ?? []).map((s) => {
            const owner = s.profiles as { email: string | null } | null;
            return (
              <div
                key={s.id}
                className="rounded-md border border-gray-200 p-3 text-sm"
              >
                <p className="font-medium">
                  {s.name}{" "}
                  <span className="font-normal text-gray-400">({s.slug})</span>
                </p>
                <p className="mt-1 font-mono text-xs text-gray-500">id: {s.id}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Dueño: {owner?.email ?? "— del sistema —"} · Creada:{" "}
                  {formatDate(s.created_at)}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
