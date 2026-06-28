# Architecture Decision Records (ADR)

Esta carpeta registra las decisiones de arquitectura del proyecto: el contexto en
que se tomaron, la decision, sus consecuencias y las alternativas descartadas.

Cada ADR es inmutable una vez aceptada. Si una decision cambia, se crea una ADR
nueva que la reemplaza, no se reescribe la anterior.

## Indice

| ADR | Titulo | Estado |
|---|---|---|
| [0001](./0001-arquitectura-serving-publico.md) | Arquitectura del plano de serving publico | Aceptada |

## Documentos relacionados

- `docs/serving-publico.md` — guia de implementacion del plano publico.
- `docs/serving-implementation-plan.md` — plan por fases de las piezas pendientes.
- `docs/serving-pii-review.md` — revision de exposiciones de PII y mitigacion.
- `docs/openapi-public-serving.json` — contrato HTTP del plano publico.
