import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Role = Database["public"]["Enums"]["user_role"];

/** Único rol con acceso al panel interno en v1. */
export const ADMIN_ROLES: Role[] = ["admin"];

export type SessionProfile = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: Role;
};

/**
 * Devuelve el perfil del usuario autenticado (o null si no hay sesión).
 * Lee el rol desde la tabla profiles.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? null,
    fullName: profile?.full_name ?? null,
    role: (profile?.role ?? "public_submitter") as Role,
  };
}

export function hasRole(profile: SessionProfile | null, allowed: Role[]): boolean {
  return !!profile && allowed.includes(profile.role);
}

/** Lanza si el usuario no cumple el rol mínimo. Usar en route handlers / actions. */
export async function requireRole(allowed: Role[]): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!hasRole(profile, allowed)) {
    throw new AuthorizationError();
  }
  return profile as SessionProfile;
}

export class AuthorizationError extends Error {
  constructor() {
    super("No autorizado");
    this.name = "AuthorizationError";
  }
}
