import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Verifica el enlace de invitación (y otros OTP de email basados en token_hash).
 * Al verificar, Supabase establece la cookie de sesión, dejando al usuario
 * autenticado; luego lo redirigimos a `next` (por defecto, /auth/set-password).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/auth/set-password";

  // Evita open redirects: solo rutas internas.
  const next = nextParam.startsWith("/") ? nextParam : "/auth/set-password";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=invite", request.url));
}
