# Specs — Spec-Driven Development (SDD)

Regla de oro del proyecto: **cada cambio nace de un spec pequeno y se entrega en un
PR facil de leer**. Un proposito por PR, pocos archivos, revisable en una sentada.

No usamos tooling externo: un spec es un markdown en esta carpeta siguiendo
[`TEMPLATE.md`](./TEMPLATE.md).

## Como se trabaja

1. Escribe el spec: copia `TEMPLATE.md` a `NNNN-titulo-en-kebab.md` (numeracion
   correlativa) y completalo. El **Alcance** debe caber en un PR.
2. Abre PR del spec (o incluyelo en el PR de la feature si es trivial). El spec es
   el contrato de lo que se va a construir.
3. Implementa en una rama `feat/<kebab>` (o `docs/<kebab>` para specs/docs).
   Conventional commits (`feat(serving): ...`). El PR **referencia su spec**.
4. El PR cierra cuando cumple los **Criterios de aceptacion** del spec, con tests.

Si una feature no cabe en un PR legible, **partela en varios specs**.

## Indice / backlog

Estado: `propuesto` · `en curso` · `hecho`.

| Spec | Titulo | Depende de | Estado |
|---|---|---|---|
| [0001](./0001-worker-healthz.md) | Worker skeleton + /healthz | — | en curso |
| 0002 | D1 binding + carga del artefacto (consume PR #10) | PR #10 | propuesto |
| 0003 | GET /v1/events (status, limit<=20) | 0001 | propuesto |
| 0004 | GET /v1/acopio (estado, needs, status, limit<=20) | 0001 | propuesto |
| 0005 | FTS5 nombre en export + GET /v1/personas + /{id} | 0001, PR #10 | propuesto |
| 0006 | Cache en el borde (Cache-Control + reglas CF) | 0003-0005 | propuesto |
| 0007 | Rate-limit + Turnstile + WAF | 0006 | propuesto |
| 0008 | Denylist / derecho al olvido (export) | PR #10 | propuesto |
| 0009 | CI/CD: cron del export + deploy del Worker | 0002 | propuesto |
| 0010 | PII fix: lectura de aportes (quitar raw_* del publico) | — | propuesto |
| 0011 | PII fix: person_notes/sources/photos sin anon directo | — | propuesto |
| 0012 | Decision is_minor en la proyeccion | — | propuesto |
| 0013 | Ingesta de staging para dedup cross-source (aportes + watermarks) | — | hecho |
| [0014](./0014-dedup-consolidation.md) | Esquema de consolidacion para el dedup job | 0013 | en curso |
| [0016](./0016-quarantine-records.md) | Quarantine DB + POST /api/v1/quarantine (VZLA_DEDUP #88) | 0013 | en curso |

Cross-repo (fuera de este repo): mapear enums ES->EN en el pipeline de VZLA_DEDUP
antes de la ingesta.

## Relacion con los ADR

Los **ADR** (`docs/adr/`) registran *decisiones* de arquitectura (el porque). Los
**specs** describen *unidades de trabajo* concretas que implementan esas decisiones.
Un spec suele referenciar el ADR que lo motiva (ej. los specs 0001-0009 derivan de
[`adr/0001`](../adr/0001-arquitectura-serving-publico.md) y de
[`serving-implementation-plan.md`](../serving-implementation-plan.md)).
