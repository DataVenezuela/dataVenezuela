import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./SetPasswordForm";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sin sesión activa (enlace inválido o expirado) → al login.
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold">Crear contraseña</h1>
      <p className="mb-6 text-sm text-gray-600">
        Define una contraseña para <strong>{user.email}</strong> y accede.
      </p>

      <SetPasswordForm />
    </main>
  );
}
