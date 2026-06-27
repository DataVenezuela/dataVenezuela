import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile, hasRole, ADMIN_ROLES } from "@/lib/auth";
import { roleLabels } from "@/lib/labels";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/admin/users", label: "Usuarios" },
  { href: "/admin/sources", label: "Fuentes" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?redirect=/admin");

  if (!hasRole(profile, ADMIN_ROLES)) {
    return (
      <main className="mx-auto max-w-lg flex-1 px-6 py-16 text-center">
        <h1 className="text-xl font-bold">Sin acceso</h1>
        <p className="mt-2 text-sm text-gray-600">
          Tu rol ({roleLabels[profile.role] ?? profile.role}) no tiene acceso al
          panel interno.
        </p>
        <form action={logout} className="mt-4">
          <button className="text-sm text-blue-600 hover:underline">
            Cerrar sesión
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="w-60 shrink-0 border-r border-gray-200 bg-white p-4">
        <Link href="/" className="text-lg font-bold">
          dataVenezuela
        </Link>
        <p className="mt-0.5 text-xs text-gray-500">Panel interno</p>
        <nav className="mt-6 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <span className="text-sm text-gray-600">
            {profile.email}{" "}
            <span className="ml-1 rounded bg-gray-100 px-2 py-0.5 text-xs">
              {roleLabels[profile.role] ?? profile.role}
            </span>
          </span>
          <form action={logout}>
            <button className="text-sm text-gray-500 hover:text-gray-900">
              Cerrar sesión
            </button>
          </form>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}
