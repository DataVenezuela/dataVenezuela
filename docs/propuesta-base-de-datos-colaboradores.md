# Modelo de datos — v1 (ingesta de aportes)

> Estado: **implementado (primera versión)**.
> Esta versión se centra en la **ingesta** de datos. La verificación se construirá
> más adelante sobre la tabla `aportes`.

---

## 1. Idea central: dos tablas núcleo

| Tabla | Qué es |
|---|---|
| **`sources`** (fuentes) | Define una fuente de datos. La crea/asigna el equipo; puede pertenecer a un scraper. |
| **`aportes`** (datos) | Los datos en bruto subidos por un scraper, atribuidos a una fuente. **Sin esquema estricto** (jsonb + texto) para recibir cualquier tipo de información. |

El resto de tablas (`profiles`, `scraper_applications`, `partner_api_keys`) existe
para que esas dos funcionen.

---

## 2. Personas y roles (`user_role`)

```
public_submitter   -- usuario sin permisos especiales (rol por defecto)
scraper            -- dev que sube datos por su propia API key (requiere aprobación)
admin              -- superusuario: gestiona usuarios, fuentes y aprobaciones
```

- **Superusuario = `admin`** (en la interfaz, "Superusuario").
- **Scrapers con aprobación**: registro → `pending` → el admin aprueba → puede
  generar API keys y subir datos.
- En v1 **no hay roles de verificación** (volunteer/verifier/lead); se añadirán
  cuando se construya la verificación.

---

## 3. Tablas

### 3.1 `profiles` — identidad y rol
`id`, `email`, `full_name`, `role`, `scraper_status` (`pending`/`approved`/
`rejected`, o vacío), timestamps. `scraper_status` es independiente de `role`.

### 3.2 `scraper_applications` — solicitud de alta del scraper
`profile_id`, `source_name`, `website`, `social_url`, `description`, `status`,
`reviewed_by`, `reviewed_at`. Al **aprobar**: el perfil pasa a `role = 'scraper'`
+ `scraper_status = 'approved'`, se crea su primera **fuente**, y la solicitud
queda `approved`.

### 3.3 `sources` — la fuente de los datos (mínima)
| Columna | Propósito |
|---|---|
| `id` | Identificador (se usa como `source_id` en los aportes) |
| `name` | Nombre visible |
| `slug` | Identificador estable legible (único) |
| `website` | Enlace público |
| `owner_id` | Scraper dueño (vacío = fuente del sistema) |

Un scraper puede tener **varias fuentes** (varias filas con el mismo `owner_id`).

### 3.4 `partner_api_keys` — keys de escritura
`id`, `owner_id` (el scraper dueño de la key), `name`, `key_hash` (nunca en
claro), `active`, `last_used_at`, `created_at`. **La key identifica al scraper**;
la fuente concreta viaja en cada aporte (`source_id`).

### 3.5 `aportes` — los datos (núcleo flexible)
| Columna | Propósito |
|---|---|
| `id` | Id interno |
| `external_id` | Id externo configurado por el scraper (anti-duplicados) |
| `raw_json` | Datos en JSON en bruto (jsonb) |
| `raw_text` | Datos en texto en bruto |
| `source_id` | Fuente del dato |
| `scraper_id` | Dev que subió el dato |

Restricción: al menos uno de `raw_json`/`raw_text`. **Anti-duplicados**: índice
único sobre `(scraper_id, external_id)` — un mismo scraper no puede subir dos
veces el mismo `external_id`.

---

## 4. Cómo se relacionan

```
Usuario (profiles)
  │  role, scraper_status
  ├──< scraper_applications   (una solicitud por usuario)
  ├──< sources (owner_id)     (una o varias fuentes del scraper)
  ├──< partner_api_keys       (las keys del scraper; solo el hash)
  └──< aportes (scraper_id)   (los datos subidos)
                  └─ source_id → sources
```

---

## 5. Acceso

- **Escritura (ingesta)**: requiere `x-api-key`. La key → scraper; el cuerpo trae
  `source_id` **o** `source_slug` (el sistema resuelve el id), validado como propio
  del scraper.
- **Lectura de aportes**: **pública** vía los route handlers (`/api/aportes`),
  con columnas seguras (no expone `scraper_id`).
- **Acciones internas** (aprobar scraper, crear/asignar fuente, crear/revocar
  key, cambiar rol): solo `admin`, validado en código. RLS es la red de seguridad
  para usuarios autenticados.

---

## 6. Flujo extremo a extremo

```
1. Scraper se registra            → usuario (pending) + solicitud
2. Admin aprueba                  → scraper aprobado + su primera fuente
3. Admin crea/asigna más fuentes  → (opcional) /admin/sources
4. Scraper genera una API key     → se muestra una sola vez; se guarda el hash
5. Scraper sube datos por la API  → POST /api/aportes (x-api-key + source_id)
6. Cualquiera lee los aportes     → GET /api/aportes (público)
```

---

## 7. Pendiente para versiones futuras

- Verificación de los aportes (roles de staff, evidencia, veredictos, publicación).
- Llaves de API de **lectura** (hoy la lectura es abierta).
- Aprobación de **fuentes** propuestas por scrapers (hoy las gestiona el equipo).
- Caducidad/rotación de API keys.
