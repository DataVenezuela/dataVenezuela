// Etiquetas en español para los enums del sistema.

export const roleLabels: Record<string, string> = {
  public_submitter: "Usuario",
  scraper: "Scraper / Recolector",
  admin: "Superusuario",
};

export function labelFor(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return map[key] ?? key;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
