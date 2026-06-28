# SPEC-NNNN — <titulo corto>

| Campo | Valor |
|---|---|
| Estado | propuesto / en curso / hecho |
| Depende de | <specs o PRs previos, o "—"> |
| ADR / motivacion | <ej. adr/0001, o "—"> |
| PR | <numero cuando exista> |

## Contexto

Por que existe este trabajo. El problema o la necesidad. 2-4 frases.

## Alcance (cabe en 1 PR)

Que se construye, en bullets. Debe ser revisable en una sentada. Si crece, partir
en otro spec.

## Contrato / Interfaz

La forma observable del cambio: endpoint(s), esquema de request/response, firma de
funcion, tabla/columna, archivo de salida. Citar la fuente de verdad si aplica
(ej. `docs/openapi-public-serving.json`). No inventar contratos.

## Criterios de aceptacion

Lista verificable de "esta hecho cuando...". Cada item debe poder comprobarse con
un test o un comando.

- [ ] ...
- [ ] ...

## Fuera de alcance

Lo que este PR deliberadamente NO hace (y, si aplica, en que spec va).

## Dependencias

Specs, PRs, migraciones, secretos o cuentas que deben existir antes.

## Verificacion

Comandos/pasos para probar de extremo a extremo (tests, dev local, curl).
