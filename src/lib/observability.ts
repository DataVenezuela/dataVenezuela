// Observabilidad mínima para la ingesta: un request_id por petición y una línea
// JSON estructurada con la latencia, el scraper y el resultado. Sin dependencias.

export type IngestLog = {
  request_id: string;
  route: string;
  scraper_id: string | null;
  status: number;
  latency_ms: number;
  rejected: boolean; // true cuando la validación de contrato rechazó el payload
};

export function newRequestId(): string {
  return crypto.randomUUID();
}

export function logIngest(entry: IngestLog): void {
  console.log(JSON.stringify({ kind: "ingest", ...entry }));
}
