import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile, hasRole, ADMIN_ROLES } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { roleLabels, formatDate } from "@/lib/labels";
import { card, btnSecondary, btnDanger } from "@/lib/ui";
import { logout } from "../admin/actions";
import { CreateKeyForm } from "./CreateKeyForm";
import { revokeApiKeyAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?redirect=/account");

  const supabase = createAdminClient();
  const { data: prof } = await supabase
    .from("profiles")
    .select("scraper_status")
    .eq("id", profile.userId)
    .maybeSingle();
  const scraperStatus = prof?.scraper_status ?? null;

  const isScraper = profile.role === "scraper";
  const isApprovedScraper = isScraper && scraperStatus === "approved";
  const isAdmin = hasRole(profile, ADMIN_ROLES);

  // Fuentes y keys del scraper aprobado.
  let sources: { id: string; name: string; slug: string }[] = [];
  let keys: {
    id: string;
    name: string;
    active: boolean;
    last_used_at: string | null;
    created_at: string;
  }[] = [];
  if (isApprovedScraper) {
    const { data: srcRows } = await supabase
      .from("sources")
      .select("id, name, slug")
      .eq("owner_id", profile.userId)
      .order("name", { ascending: true });
    sources = srcRows ?? [];

    const { data: keyRows } = await supabase
      .from("partner_api_keys")
      .select("id, name, active, last_used_at, created_at")
      .eq("owner_id", profile.userId)
      .order("created_at", { ascending: false });
    keys = keyRows ?? [];
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/" className="text-sm text-gray-500 hover:underline">
            ← Inicio
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Mi cuenta</h1>
          <p className="mt-1 text-sm text-gray-600">
            {profile.email}{" "}
            <span className="ml-1 rounded bg-gray-100 px-2 py-0.5 text-xs">
              {roleLabels[profile.role] ?? profile.role}
            </span>
          </p>
        </div>
        <form action={logout}>
          <button className="text-sm text-gray-500 hover:text-gray-900">
            Cerrar sesión
          </button>
        </form>
      </div>

      {/* Acceso al panel interno para admin */}
      {isAdmin && (
        <div className={`mt-6 ${card}`}>
          <p className="text-sm text-gray-700">Tienes acceso al panel interno.</p>
          <Link href="/admin" className={`mt-3 ${btnSecondary}`}>
            Ir al panel interno
          </Link>
        </div>
      )}

      {/* Scraper pendiente / rechazado */}
      {isScraper && !isApprovedScraper && (
        <div className={`mt-6 ${card}`}>
          {scraperStatus === "rejected" ? (
            <p className="text-sm text-red-700">
              Tu solicitud fue rechazada. Contacta al equipo si crees que es un
              error.
            </p>
          ) : (
            <p className="text-sm text-gray-700">
              Tu solicitud está <strong>en revisión</strong>. Cuando un
              superusuario la apruebe, podrás generar tus API keys aquí.
            </p>
          )}
        </div>
      )}

      {/* Fuentes y API keys (scraper aprobado) */}
      {isApprovedScraper && (
        <>
          <section className={`mt-6 ${card}`}>
            <h2 className="font-semibold">Mis fuentes</h2>
            <p className="mt-1 text-sm text-gray-600">
              El equipo te asigna las fuentes. Al subir aportes identifica la
              fuente con su <code>id</code> (<code>source_id</code>) o su{" "}
              <code>slug</code> (<code>source_slug</code>).
            </p>
            <div className="mt-3 space-y-2">
              {sources.length === 0 && (
                <p className="text-sm text-gray-500">
                  Aún no tienes fuentes asignadas. Pídele al equipo que cree una.
                </p>
              )}
              {sources.map((s) => (
                <div
                  key={s.id}
                  className="rounded-md border border-gray-200 p-3 text-sm"
                >
                  <p className="font-medium">
                    {s.name}{" "}
                    <span className="font-normal text-gray-400">({s.slug})</span>
                  </p>
                  <p className="mt-1 font-mono text-xs text-gray-500">
                    source_id: {s.id}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className={`mt-6 space-y-5 ${card}`}>
            <div>
              <h2 className="font-semibold">API keys</h2>
              <p className="mt-1 text-sm text-gray-600">
                Usa estas keys para subir datos a <code>/api/aportes</code> con el
                header <code>x-api-key</code>. Incluye <code>source_id</code> en el
                cuerpo de cada aporte.{" "}
                <Link href="/docs" className="text-blue-600 hover:underline">
                  Ver la documentación
                </Link>
                .
              </p>
            </div>

            <CreateKeyForm />

            <div className="space-y-2">
              {keys.length === 0 && (
                <p className="text-sm text-gray-500">Aún no tienes keys.</p>
              )}
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between rounded-md border border-gray-200 p-3"
                >
                  <div className="text-sm">
                    <p className="font-medium">
                      {k.name}{" "}
                      {!k.active && (
                        <span className="ml-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          revocada
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      Creada: {formatDate(k.created_at)} · Último uso:{" "}
                      {formatDate(k.last_used_at)}
                    </p>
                  </div>
                  {k.active && (
                    <form action={revokeApiKeyAction}>
                      <input type="hidden" name="keyId" value={k.id} />
                      <button className={btnDanger}>Revocar</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Usuario sin rol de colaborador */}
      {!isScraper && !isAdmin && (
        <div className={`mt-6 ${card}`}>
          <p className="text-sm text-gray-700">
            Tu cuenta no tiene permisos especiales todavía. Si eres
            scraper/recolector,{" "}
            <Link href="/register" className="text-blue-600 hover:underline">
              envía una solicitud
            </Link>
            .
          </p>
        </div>
      )}
    </main>
  );
}
