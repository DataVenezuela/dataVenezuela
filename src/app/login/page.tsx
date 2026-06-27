import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; registered?: string }>;
}) {
  const { redirect, registered } = await searchParams;
  // Permitimos volver a una ruta interna conocida; por defecto, la cuenta.
  const target =
    redirect && (redirect.startsWith("/admin") || redirect.startsWith("/account"))
      ? redirect
      : "/account";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold">Iniciar sesión</h1>
      <p className="mb-6 text-sm text-gray-600">
        Acceso para el equipo y para scrapers/recolectores.
      </p>

      {registered && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
          Solicitud enviada. Inicia sesión; tu acceso para generar API keys se
          habilitará cuando un superusuario apruebe tu cuenta.
        </div>
      )}

      <LoginForm redirect={target} />
    </main>
  );
}
