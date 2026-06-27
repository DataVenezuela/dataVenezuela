# API de ingesta — esquema normalizado (Vzla_Dedup)

Endpoints para que los scrapers creen registros en el modelo normalizado y
deduplicado (`events`, `persons`, `person_notes`, `person_sources`,
`person_photos`, `acopio_centers`). Comparten el patrón de `POST /api/aportes`:

- **Auth**: header `x-api-key` (la misma key de scraper). Sin/clave inválida → `401`.
- **Body**: JSON. Cuerpo no-JSON → `400`.
- **Validación de contrato**: Zod. Payload inválido → `422` con `issues[]`.
- **FKs**: se validan en la API antes de insertar. Referencia inexistente → `404`.
- **Éxito**: `201` con `{ "id": "<uuid>", "status": "created" }`. El header
  `x-request-id` correlaciona la petición con el log de observabilidad.

> **Privacidad**: el scraper envía `cedula_hmac` / `contact_hmac` ya hasheados
> (SHA-256 en hex, 64 caracteres) y los `*_masked` ya enmascarados. La API nunca
> recibe PII en claro; solo valida el formato.

Convenciones de tipos: fechas en **ISO 8601 UTC** (`timestamptz`), booleanos
nativos, `confidence_score` en `[0.000, 1.000]`. Los campos opcionales aceptan
ausencia o `null`.

---

## Enums controlados

| Campo | Valores |
|---|---|
| `events.event_type` | `earthquake`, `flood`, `landslide`, `other` |
| `events.status` | `active`, `monitoring`, `closed` |
| `persons.status` | `missing`, `found`, `injured`, `deceased`, `unknown` |
| `persons.verification_status` | `unverified`, `pending`, `verified`, `conflicting` |
| `persons.sex` | `M`, `F`, `unknown` |
| `person_notes.note_type` | `missing`, `injured`, `found`, `deceased` |
| `person_notes.status` | `active`, `superseded`, `retracted` |
| `person_notes.severity` | `leve`, `moderado`, `grave`, `critico`, `unknown` |
| `person_notes.identification_status` | `identified`, `unidentified`, `pending` |
| `person_sources.trust_tier` | `1` (oficial), `2` (ONG), `3` (social/anónimo) |
| `acopio_centers.status` | `active`, `full`, `closed`, `unverified` |
| `acopio_centers.needs[]` | `agua`, `alimentos`, `medicamentos`, `colchonetas`, `ropa`, `calzado`, `higiene`, `pañales`, `leche_formula`, `generador`, `combustible`, `herramientas`, `voluntarios`, `transporte`, `otro` — cualquier valor fuera de la lista se normaliza a `otro` |

---

## `POST /api/v1/dedup/events`

| Campo | Tipo | Requerido |
|---|---|---|
| `name` | texto | sí |
| `event_type` | enum | sí |
| `occurred_at` | ISO UTC | sí |
| `status` | enum | sí |
| `affected_states` | array (jsonb) | no |
| `magnitude` | número | no |
| `depth_km` | número | no |
| `external_ids` | objeto (jsonb) | no |

```bash
curl -X POST http://localhost:3000/api/v1/dedup/events \
  -H "x-api-key: TU_API_KEY" -H "content-type: application/json" \
  -d '{"name":"Terremoto Yaracuy","event_type":"earthquake","occurred_at":"2026-06-24T12:00:00Z","status":"active","magnitude":5.4}'
```

## `POST /api/v1/dedup/persons`

| Campo | Tipo | Requerido |
|---|---|---|
| `event_id` | UUID (FK → events) | sí |
| `status` | enum | sí |
| `verification_status` | enum | sí |
| `full_name` | texto | no |
| `alternate_names` | array (jsonb) | no |
| `cedula_hmac` | hex SHA-256 (64) | no |
| `cedula_masked` | texto ≤15 | no |
| `age_range` | objeto `{min,max}` | no |
| `sex` | enum | no |
| `is_minor` | booleano | no |
| `last_known_location` | objeto (jsonb) | no |
| `confidence_score` | número `[0,1]` | no (def. 0) |
| `source_url` | URL | no |

```bash
curl -X POST http://localhost:3000/api/v1/dedup/persons \
  -H "x-api-key: TU_API_KEY" -H "content-type: application/json" \
  -d '{"event_id":"EVENT_ID","full_name":"juan perez","status":"missing","verification_status":"unverified","confidence_score":0.75}'
```

## `POST /api/v1/dedup/person-notes`

Una sola tabla con columnas *sparse* por `note_type`. Requeridos:
`person_record_id` (FK → persons), `note_type`, `status`. Resto opcional:
`found_by`, `source_date`, `entry_date`, `found`, `last_known_location`;
`last_seen_at` / `last_seen_location` (missing); `hospital_name`,
`hospital_municipio`, `severity`, `admitted_time` (injured); `found_at` (found);
`deceased_at`, `recovery_location`, `identification_status`, `confirmed_by`
(deceased).

```bash
curl -X POST http://localhost:3000/api/v1/dedup/person-notes \
  -H "x-api-key: TU_API_KEY" -H "content-type: application/json" \
  -d '{"person_record_id":"PERSON_ID","note_type":"missing","status":"active","last_seen_at":"2026-06-24T18:00:00Z"}'
```

## `POST /api/v1/dedup/person-sources`

| Campo | Tipo | Requerido |
|---|---|---|
| `person_record_id` | UUID (FK → persons) | sí |
| `source_url` | URL | sí |
| `trust_tier` | `1` \| `2` \| `3` | sí |
| `ext_id` | texto | no |
| `fetched_at` | ISO UTC | no (def. now) |

## `POST /api/v1/dedup/person-photos`

| Campo | Tipo | Requerido |
|---|---|---|
| `person_record_id` | UUID (FK → persons) | sí |
| `url` | URL | sí |
| `caption` | texto | no |
| `source_id` | UUID (FK → person_sources) | no |
| `uploaded_at` | ISO UTC | no (def. now) |

## `POST /api/v1/dedup/acopio-centers`

| Campo | Tipo | Requerido |
|---|---|---|
| `event_id` | UUID (FK → events) | sí |
| `name` | texto | sí |
| `status` | enum | sí |
| `location` | objeto (jsonb) | no |
| `confidence_score` | número `[0,1]` | no (def. 0) |
| `needs` | array de keywords | no |
| `last_verified_at` | ISO UTC | no |
| `managing_org` | texto | no |
| `contact_hmac` | hex SHA-256 (64) | no |
| `contact_masked` | texto ≤30 | no |
| `capacity` | entero | no |
| `current_load` | entero | no |

---

## Códigos de error

| Código | Significado |
|---|---|
| `400` | El cuerpo no es JSON válido. |
| `401` | API key ausente o inválida. |
| `404` | Una FK del payload no existe. La respuesta incluye `field`. |
| `422` | Contrato inválido. Incluye `issues[]` con `path` y `message`. |
| `500` | Error interno. |

Ejemplo `404`:

```json
{ "error": "La referencia event_id=… no existe", "field": "event_id" }
```

Ejemplo `422`:

```json
{
  "error": "Datos inválidos",
  "issues": [{ "path": "confidence_score", "message": "confidence_score <= 1" }]
}
```
