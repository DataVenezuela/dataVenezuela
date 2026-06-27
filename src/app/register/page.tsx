import Link from "next/link";
import { registerScraperAction } from "./actions";
import { input, label, btnPrimary, card } from "@/lib/ui";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string }>;
}) {
  const { status, msg } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← Inicio
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Registro de scraper / recolector</h1>
      <p className="mt-1 text-sm text-gray-600">
        Crea tu cuenta para subir datos a la plataforma. Un superusuario revisará
        tu solicitud; una vez aprobada podrás generar tus API keys desde tu
        cuenta.
      </p>

      {status === "error" && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          No se pudo registrar: {msg ? decodeURIComponent(msg) : "datos inválidos"}.
        </div>
      )}

      <form action={registerScraperAction} className={`mt-6 space-y-5 ${card}`}>
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-700">
            Tu cuenta
          </legend>
          <div>
            <label className={label} htmlFor="fullName">
              Nombre completo *
            </label>
            <input id="fullName" name="fullName" required className={input} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="email">
                Correo *
              </label>
              <input id="email" name="email" type="email" required className={input} />
            </div>
            <div>
              <label className={label} htmlFor="password">
                Contraseña * (mín. 8)
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                className={input}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-md border border-gray-200 p-4">
          <legend className="px-1 text-sm font-semibold text-gray-700">
            Tu fuente de datos
          </legend>
          <div>
            <label className={label} htmlFor="sourceName">
              Nombre de la fuente / scraper *
            </label>
            <input id="sourceName" name="sourceName" required className={input} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="website">
                Sitio web
              </label>
              <input
                id="website"
                name="website"
                type="url"
                placeholder="https://..."
                className={input}
              />
            </div>
            <div>
              <label className={label} htmlFor="socialUrl">
                Red social
              </label>
              <input
                id="socialUrl"
                name="socialUrl"
                type="url"
                placeholder="https://..."
                className={input}
              />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="description">
              ¿Qué datos recolectas y de dónde?
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className={input}
            />
          </div>
        </fieldset>

        <button type="submit" className={btnPrimary}>
          Enviar solicitud
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-600">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          Inicia sesión
        </Link>
        .
      </p>
    </main>
  );
}
