import { getSessionProfile, hasRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { roleLabels, formatDate } from "@/lib/labels";
import { input, label, btnPrimary, btnSecondary, btnDanger, card } from "@/lib/ui";
import {
  approveScraperAction,
  rejectScraperAction,
  changeRoleAction,
  createUserAction,
} from "./actions";

export const dynamic = "force-dynamic";

const ASSIGNABLE_ROLES = ["public_submitter", "scraper", "admin"] as const;

export default async function UsersPage() {
  const profile = await getSessionProfile();
  if (!hasRole(profile, ["admin"])) {
    return (
      <main className="max-w-lg">
        <h1 className="text-xl font-bold">Sin acceso</h1>
        <p className="mt-2 text-sm text-gray-600">
          Solo un superusuario puede gestionar usuarios.
        </p>
      </main>
    );
  }

  const supabase = createAdminClient();

  const { data: pending } = await supabase
    .from("scraper_applications")
    .select(
      "id, source_name, website, social_url, description, created_at, profiles!scraper_applications_profile_id_fkey(email, full_name)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, scraper_status")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="mt-1 text-sm text-gray-600">
          Aprueba scrapers, ajusta roles y registra usuarios internos.
        </p>
      </div>

      {/* Solicitudes de scraper */}
      <section className={card}>
        <h2 className="font-semibold">Solicitudes de scraper</h2>
        <div className="mt-3 space-y-3">
          {(pending ?? []).length === 0 && (
            <p className="text-sm text-gray-500">No hay solicitudes pendientes.</p>
          )}
          {(pending ?? []).map((a) => {
            const p = a.profiles as { email: string | null; full_name: string | null } | null;
            return (
              <div
                key={a.id}
                className="rounded-md border border-gray-200 p-3 text-sm"
              >
                <p className="font-medium">
                  {a.source_name}{" "}
                  <span className="font-normal text-gray-500">
                    — {p?.full_name ?? "—"} ({p?.email ?? "—"})
                  </span>
                </p>
                {a.description && (
                  <p className="mt-1 text-gray-600">{a.description}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {a.website && (
                    <a href={a.website} className="text-blue-600 hover:underline">
                      {a.website}
                    </a>
                  )}
                  {a.website && a.social_url ? " · " : ""}
                  {a.social_url && (
                    <a href={a.social_url} className="text-blue-600 hover:underline">
                      {a.social_url}
                    </a>
                  )}
                  {" · "}Solicitado: {formatDate(a.created_at)}
                </p>
                <div className="mt-2 flex gap-2">
                  <form action={approveScraperAction}>
                    <input type="hidden" name="applicationId" value={a.id} />
                    <button className={btnPrimary}>Aprobar</button>
                  </form>
                  <form action={rejectScraperAction}>
                    <input type="hidden" name="applicationId" value={a.id} />
                    <button className={btnDanger}>Rechazar</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Crear usuario interno */}
      <section className={card}>
        <h2 className="font-semibold">Registrar usuario interno</h2>
        <form action={createUserAction} className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="fullName">Nombre completo</label>
            <input id="fullName" name="fullName" className={input} />
          </div>
          <div>
            <label className={label} htmlFor="email">Correo *</label>
            <input id="email" name="email" type="email" required className={input} />
          </div>
          <div>
            <label className={label} htmlFor="password">Contraseña * (mín. 8)</label>
            <input id="password" name="password" type="password" required minLength={8} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="role">Rol</label>
            <select id="role" name="role" defaultValue="admin" className={input}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{roleLabels[r] ?? r}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button className={btnPrimary}>Crear usuario</button>
          </div>
        </form>
      </section>

      {/* Lista de usuarios */}
      <section className={card}>
        <h2 className="font-semibold">Todos los usuarios</h2>
        <div className="mt-3 space-y-2">
          {(users ?? []).map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-3 text-sm"
            >
              <div>
                <p className="font-medium">{u.full_name ?? "—"}</p>
                <p className="text-xs text-gray-500">
                  {u.email}
                  {u.scraper_status ? ` · scraper: ${u.scraper_status}` : ""}
                </p>
              </div>
              <form action={changeRoleAction} className="flex items-center gap-2">
                <input type="hidden" name="profileId" value={u.id} />
                <select name="role" defaultValue={u.role} className={`${input} w-auto`}>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{roleLabels[r] ?? r}</option>
                  ))}
                </select>
                <button className={btnSecondary}>Guardar</button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
