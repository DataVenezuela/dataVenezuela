export interface Env {
  // El binding D1 es opcional en SPEC-0001: el Worker corre sin artefacto.
  // Se vuelve obligatorio al conectar la D1 real en SPEC-0002.
  DB?: D1Database;
}
