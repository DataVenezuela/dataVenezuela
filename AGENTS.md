<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Regla de oro: Spec-Driven Development

Cada cambio nace de un **spec pequeno** y se entrega en un **PR facil de leer** (un
proposito, pocos archivos). Antes de codear una feature:

1. Escribe/lee su spec en `docs/specs/` (plantilla en `docs/specs/TEMPLATE.md`).
2. Implementa en una rama `feat/<kebab>` (o `docs/<kebab>`), con
   **Conventional Commits** (`feat(scope): ...`).
3. El PR **referencia su spec** y cierra cumpliendo sus criterios de aceptacion,
   con tests.

Si una feature no cabe en un PR legible, partela en varios specs. Ver
`docs/specs/README.md`.
