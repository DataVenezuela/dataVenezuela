# Serving publico Worker/D1

Este repo es el plano interno de datos: Supabase/Postgres guarda el modelo
normalizado y recibe escrituras de los scrapers. El plano publico debe quedar
separado: un Worker de Cloudflare consulta un artefacto D1/SQLite de solo lectura
y no abre conexiones publicas contra Supabase.

## Responsabilidad de este repo

- Declarar la proyeccion segura desde la base en
  `supabase/migrations/0007_public_serving_projection.sql`.
- Mantener el contrato HTTP en `docs/openapi-public-serving.json`.
- Servir como fuente del job que materializa Supabase -> D1/SQLite.

## Flujo esperado

1. Los scrapers escriben en las tablas normalizadas de Supabase.
2. Un job interno lee las vistas `public_serving_*` con `service_role`.
3. El job publica un artefacto D1/SQLite inmutable o intercambiable de forma
   atomica.
4. El Worker responde `GET /v1/personas`, `GET /v1/acopio`, `GET /v1/events` y
   `GET /healthz` desde ese artefacto.

## Exportar artefacto D1

El primer job disponible genera SQL importable por Cloudflare D1:

```bash
npm run public-serving:export > /tmp/public-serving.sql
npx wrangler d1 execute <DB_NAME> --remote --file /tmp/public-serving.sql
```

Requiere `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. En local se
cargan desde `.env.local` por el script de npm.

## Privacidad

El contrato HTTP nunca expone campos de ingesta o secretos operativos como
`raw_json`, `raw_text`, `scraper_id`, `partner_api_keys`, `cedula_hmac` o
`contact_hmac`.

La vista `public_serving_persons` conserva `cedula_hmac` solo como llave interna
del artefacto para busquedas controladas. Esa columna no forma parte de las
respuestas publicas. Las fotos reales, contactos en claro y datos medicos
identificables quedan fuera de esta primera proyeccion.

## Fuera de alcance de este PR

- Implementar el Worker.
- Implementar el job de publicacion a D1/SQLite.
- Cambiar o revocar los grants existentes de compatibilidad sobre tablas
  normalizadas.
