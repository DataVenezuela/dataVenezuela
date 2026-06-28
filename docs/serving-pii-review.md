# Revision de exposicion de PII

Esta nota documenta dos exposiciones del plano interno que contradicen el principio
del [ADR 0001](./adr/0001-arquitectura-serving-publico.md): *el plano publico no
posee datos en claro*. No aplica cambios de codigo/schema; propone mitigacion para
decision del equipo.

Contexto: el proyecto maneja datos de personas vulnerables en una crisis. El criterio
debe ser **prudencia sobre conveniencia**: ante la duda, no exponer.

---

## Hallazgo 1 — `GET /api/aportes` expone contenido crudo al publico

**Donde:** `src/app/api/aportes/route.ts`

```ts
const PUBLIC_COLUMNS = "id, external_id, raw_json, raw_text, source_id, created_at, updated_at";
```

`raw_json` y `raw_text` son el contenido scrapeado **sin estructurar**. Por
definicion pueden contener cedulas, telefonos, direcciones exactas o nombres
completos en claro — justo lo que el resto del sistema se esfuerza por hashear y
enmascarar antes de exponer. Servir esto sin autenticacion abre un canal que evade
toda la disciplina de PII del pipeline.

**Riesgo:** alto. Un tercero puede leer PII en claro y, peor, raspar `raw_text` en
masa para reconstruir identidades.

**Opciones de mitigacion:**
- (a) Exigir auth para leer crudo (solo scrapers/admin).
- (b) Restringir la lectura al scraper dueno del aporte.
- (c) **Remover `raw_json`/`raw_text` de `PUBLIC_COLUMNS`** y exponer publicamente
  solo metadatos no sensibles; el crudo se lee solo autenticado.

**Recomendado:** (c) + lectura de crudo solo autenticada. Mantiene la transparencia
de "que se ingirio" sin publicar el contenido sensible.

---

## Hallazgo 2 — `person_notes` (y `person_sources`, `person_photos`) con grant a `anon`

**Donde:** `supabase/migrations/0006_dedup_grants.sql`

```sql
grant select on public.events, public.person_notes,
  public.person_sources, public.person_photos
  to anon, authenticated;
```

A diferencia de `persons` y `acopio_centers` (que reciben grants **por columna**
excluyendo `cedula_hmac`/`contact_hmac`), estas tablas reciben grant de tabla
completa. `person_notes` incluye campos sensibles: `hospital_name`,
`hospital_municipio`, `severity`, `admitted_time`, `deceased_at`, `confirmed_by`,
`found_by`. Quedan legibles via Data API de Supabase para cualquier `anon`, **sin
pasar por la proyeccion `public_serving_*`**.

**Riesgo:** medio-alto. Estado medico, hospital y datos de fallecimiento son
sensibles y enlazables a un `person_record_id`.

**Opciones de mitigacion:**
- (a) Grants por columna en `person_notes` que excluyan los campos medicos/sensibles
  (mismo patron que `persons`).
- (b) **Quitar el acceso `anon` directo** a estas tablas y servirlas solo a traves de
  la proyeccion del plano publico (vistas + Worker/D1), coherente con el ADR.

**Recomendado:** (b). Que ninguna tabla normalizada se lea directo por `anon`; todo
lo publico pasa por la proyeccion sanitizada. Si se necesita exponer notas, crear una
vista `public_serving_person_notes` con solo campos seguros.

---

## Resumen y siguiente paso

| Hallazgo | Riesgo | Recomendado |
|---|---|---|
| `aportes` crudo publico | Alto | Quitar `raw_*` del read publico; crudo solo autenticado |
| `person_notes` a `anon` | Medio-alto | Acceso solo via proyeccion; sin `anon` directo |

Ambos cambios tocan schema/route handlers (codigo), fuera del alcance de esta
conciliacion (solo-docs). Quedan como **follow-up con decision del equipo**; al
aprobarse, se implementan en un PR aparte con su test de no-PII.
