import Link from "next/link";
import { Badge } from "@/components/Badge";
import { CodeTabs } from "@/components/CodeTabs";
import { card } from "@/lib/ui";

export const metadata = {
  title: "dataVenezuela — Documentación de la API",
  description: "Cómo subir aportes a dataVenezuela con la API de ingesta.",
};

// Código en línea con estilo consistente.
function C({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em] text-gray-800">
      {children}
    </code>
  );
}

const BASE = "http://localhost:3000";

const ingestSamples = [
  {
    label: "curl",
    code: `curl -X POST ${BASE}/api/aportes \\
  -H "x-api-key: TU_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "sourceSlug": "mi-fuente",
    "externalId": "registro-001",
    "rawJson": { "titulo": "Ejemplo", "ciudad": "Caracas" }
  }'`,
  },
  {
    label: "JavaScript",
    code: `const res = await fetch("${BASE}/api/aportes", {
  method: "POST",
  headers: {
    "x-api-key": "TU_API_KEY",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    sourceSlug: "mi-fuente",
    externalId: "registro-001",
    rawJson: { titulo: "Ejemplo", ciudad: "Caracas" },
  }),
});

const data = await res.json();
console.log(res.status, data); // 201 { id, externalId, duplicate, status }`,
  },
  {
    label: "Python",
    code: `import requests

res = requests.post(
    "${BASE}/api/aportes",
    headers={"x-api-key": "TU_API_KEY"},
    json={
        "sourceSlug": "mi-fuente",
        "externalId": "registro-001",
        "rawJson": {"titulo": "Ejemplo", "ciudad": "Caracas"},
    },
)

print(res.status_code, res.json())  # 201 {...}`,
  },
];

// Flujo encadenado del esquema normalizado: evento → persona → nota.
const dedupSamples = [
  {
    label: "curl",
    code: `# 1) Crear el evento → guarda "id" como EVENT_ID
curl -X POST ${BASE}/api/v1/dedup/events \\
  -H "x-api-key: TU_API_KEY" -H "content-type: application/json" \\
  -d '{
    "name": "Terremoto Yaracuy",
    "event_type": "earthquake",
    "occurred_at": "2026-06-24T12:00:00Z",
    "status": "active",
    "magnitude": 5.4
  }'

# 2) Crear la persona en ese evento → guarda "id" como PERSON_ID
curl -X POST ${BASE}/api/v1/dedup/persons \\
  -H "x-api-key: TU_API_KEY" -H "content-type: application/json" \\
  -d '{
    "event_id": "EVENT_ID",
    "full_name": "juan perez",
    "status": "missing",
    "verification_status": "unverified",
    "confidence_score": 0.75
  }'

# 3) Añadir una nota sobre la persona
curl -X POST ${BASE}/api/v1/dedup/person-notes \\
  -H "x-api-key: TU_API_KEY" -H "content-type: application/json" \\
  -d '{
    "person_record_id": "PERSON_ID",
    "note_type": "missing",
    "status": "active",
    "last_seen_at": "2026-06-24T18:00:00Z"
  }'`,
  },
];

export default function DocsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← Inicio
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Documentación de la API</h1>
      <p className="mt-2 text-gray-600">
        Guía para scrapers: cómo subir <strong>aportes</strong> a dataVenezuela.
        Un aporte son datos en bruto (<C>raw_json</C> y/o <C>raw_text</C>)
        atribuidos a una fuente.
      </p>

      {/* Introducción / flujo */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Antes de empezar</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-700">
          <li>
            <Link href="/register" className="text-blue-600 hover:underline">
              Regístrate
            </Link>{" "}
            como scraper/recolector.
          </li>
          <li>Espera a que un superusuario apruebe tu cuenta y te asigne una fuente.</li>
          <li>
            Genera una API key en{" "}
            <Link href="/account" className="text-blue-600 hover:underline">
              tu cuenta
            </Link>
            .
          </li>
          <li>Sube tus datos con <C>POST /api/aportes</C> (ver abajo).</li>
        </ol>
      </section>

      {/* Autenticación */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Autenticación</h2>
        <p className="mt-2 text-sm text-gray-700">
          Toda escritura requiere tu API key en el header <C>x-api-key</C>. La key
          se genera (y se muestra <strong>una sola vez</strong>) en{" "}
          <Link href="/account" className="text-blue-600 hover:underline">
            /account
          </Link>
          . Guárdala de forma segura; identifica a tu cuenta de scraper.
        </p>
        <div className="mt-3">
          <CodeTabs
            samples={[
              { label: "Header", code: `x-api-key: TU_API_KEY` },
            ]}
          />
        </div>
      </section>

      {/* Identificar la fuente */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Identificar la fuente</h2>
        <p className="mt-2 text-sm text-gray-700">
          Cada aporte se atribuye a una de <strong>tus</strong> fuentes. Puedes
          indicarla con su <C>sourceId</C> (UUID) <strong>o</strong> con su{" "}
          <C>sourceSlug</C> — el sistema resuelve el id. Ambos valores aparecen en{" "}
          <Link href="/account" className="text-blue-600 hover:underline">
            /account
          </Link>
          . Si la fuente no es tuya, la API responde <C>403</C>.
        </p>
      </section>

      {/* POST /api/aportes */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-800">POST</Badge>
          <h2 className="text-xl font-semibold">/api/aportes</h2>
        </div>
        <p className="mt-2 text-sm text-gray-700">
          Crea un aporte. El cuerpo es JSON con estos campos:
        </p>

        <div className={`mt-3 overflow-x-auto ${card} p-0`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Campo</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Requerido</th>
                <th className="px-4 py-2">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-2"><C>sourceId</C></td>
                <td className="px-4 py-2 text-gray-600">UUID</td>
                <td className="px-4 py-2 text-gray-600">uno de los dos*</td>
                <td className="px-4 py-2 text-gray-600">Id de tu fuente.</td>
              </tr>
              <tr>
                <td className="px-4 py-2"><C>sourceSlug</C></td>
                <td className="px-4 py-2 text-gray-600">texto</td>
                <td className="px-4 py-2 text-gray-600">uno de los dos*</td>
                <td className="px-4 py-2 text-gray-600">Slug de tu fuente.</td>
              </tr>
              <tr>
                <td className="px-4 py-2"><C>externalId</C></td>
                <td className="px-4 py-2 text-gray-600">texto</td>
                <td className="px-4 py-2 text-gray-600">opcional</td>
                <td className="px-4 py-2 text-gray-600">
                  Tu identificador del registro. Previene duplicados (ver abajo).
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2"><C>rawJson</C></td>
                <td className="px-4 py-2 text-gray-600">JSON</td>
                <td className="px-4 py-2 text-gray-600">uno de los dos†</td>
                <td className="px-4 py-2 text-gray-600">
                  Datos estructurados (objeto, arreglo o escalar).
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2"><C>rawText</C></td>
                <td className="px-4 py-2 text-gray-600">texto</td>
                <td className="px-4 py-2 text-gray-600">uno de los dos†</td>
                <td className="px-4 py-2 text-gray-600">Datos en texto libre.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          * Debes enviar <C>sourceId</C> o <C>sourceSlug</C>. &nbsp; † Debes enviar
          al menos uno de <C>rawJson</C> o <C>rawText</C>.
        </p>

        <h3 className="mt-5 text-sm font-semibold text-gray-700">Ejemplo</h3>
        <div className="mt-2">
          <CodeTabs samples={ingestSamples} />
        </div>
      </section>

      {/* Respuestas */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Respuestas</h2>
        <p className="mt-2 text-sm text-gray-700">
          <Badge className="bg-green-100 text-green-800">201</Badge> aporte creado.
        </p>
        <div className="mt-2">
          <CodeTabs
            samples={[
              {
                label: "201 Created",
                code: `{
  "id": "0b1c…",          // id interno del aporte
  "externalId": "registro-001",
  "duplicate": false,
  "status": "received"
}`,
              },
            ]}
          />
        </div>

        <p className="mt-4 text-sm text-gray-700">
          <Badge className="bg-blue-100 text-blue-800">200</Badge> ya existía un
          aporte con el mismo <C>externalId</C> para tu cuenta — no se crea otro.
        </p>
        <div className="mt-2">
          <CodeTabs
            samples={[
              {
                label: "200 OK (duplicado)",
                code: `{
  "id": "0b1c…",          // el id del aporte que YA existía
  "externalId": "registro-001",
  "duplicate": true,
  "status": "duplicate"
}`,
              },
            ]}
          />
        </div>

        <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Idempotencia:</strong> los aportes son únicos por{" "}
          <C>(tu cuenta, externalId)</C>. Si reintentas con el mismo{" "}
          <C>externalId</C>, recibes <C>200</C> con el aporte existente en vez de un
          duplicado. Usa un <C>externalId</C> estable por cada registro de origen.
        </div>
      </section>

      {/* Errores */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Errores</h2>
        <div className={`mt-3 overflow-x-auto ${card} p-0`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Significado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              <tr>
                <td className="px-4 py-2"><C>400</C></td>
                <td className="px-4 py-2">El cuerpo no es JSON válido.</td>
              </tr>
              <tr>
                <td className="px-4 py-2"><C>401</C></td>
                <td className="px-4 py-2">API key ausente o inválida.</td>
              </tr>
              <tr>
                <td className="px-4 py-2"><C>403</C></td>
                <td className="px-4 py-2">La fuente no existe o no es tuya.</td>
              </tr>
              <tr>
                <td className="px-4 py-2"><C>422</C></td>
                <td className="px-4 py-2">
                  Datos inválidos. La respuesta incluye <C>issues[]</C> con el campo
                  y el mensaje.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2"><C>500</C></td>
                <td className="px-4 py-2">Error interno; reintenta más tarde.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <CodeTabs
            samples={[
              {
                label: "422 ejemplo",
                code: `{
  "error": "Datos inválidos",
  "issues": [
    { "path": "sourceId", "message": "Se requiere source_id o source_slug" }
  ]
}`,
              },
            ]}
          />
        </div>
      </section>

      {/* Buenas prácticas */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Buenas prácticas</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>
            Asigna un <C>externalId</C> estable a cada registro de tu fuente: hace
            la ingesta idempotente y segura ante reintentos.
          </li>
          <li>
            Usa <C>rawJson</C> para datos estructurados y <C>rawText</C> para texto
            libre. Puedes enviar ambos.
          </li>
          <li>No incluyas secretos ni datos sensibles innecesarios en el payload.</li>
        </ul>
      </section>

      {/* Esquema normalizado (Vzla_Dedup) */}
      <section className="mt-12 border-t border-gray-200 pt-8">
        <h2 className="text-xl font-semibold">Esquema normalizado (Vzla_Dedup)</h2>
        <p className="mt-2 text-sm text-gray-700">
          Además del feed en bruto de <C>aportes</C>, puedes escribir directamente
          en el modelo <strong>normalizado y deduplicado</strong>. Misma
          autenticación (<C>x-api-key</C>) y mismo formato de errores. Cada
          endpoint crea un registro y responde <C>201</C> con{" "}
          <C>{`{ id, status: "created" }`}</C>.
        </p>

        <div className={`mt-3 overflow-x-auto ${card} p-0`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Endpoint</th>
                <th className="px-4 py-2">Crea</th>
                <th className="px-4 py-2">FK requerida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              <tr>
                <td className="px-4 py-2"><C>POST /api/v1/dedup/events</C></td>
                <td className="px-4 py-2">Evento de crisis</td>
                <td className="px-4 py-2">—</td>
              </tr>
              <tr>
                <td className="px-4 py-2"><C>POST /api/v1/dedup/persons</C></td>
                <td className="px-4 py-2">Persona del evento</td>
                <td className="px-4 py-2"><C>event_id</C></td>
              </tr>
              <tr>
                <td className="px-4 py-2"><C>POST /api/v1/dedup/person-notes</C></td>
                <td className="px-4 py-2">Hecho sobre una persona</td>
                <td className="px-4 py-2"><C>person_record_id</C></td>
              </tr>
              <tr>
                <td className="px-4 py-2"><C>POST /api/v1/dedup/person-sources</C></td>
                <td className="px-4 py-2">Fuente/corroboración</td>
                <td className="px-4 py-2"><C>person_record_id</C></td>
              </tr>
              <tr>
                <td className="px-4 py-2"><C>POST /api/v1/dedup/person-photos</C></td>
                <td className="px-4 py-2">Foto de una persona</td>
                <td className="px-4 py-2"><C>person_record_id</C></td>
              </tr>
              <tr>
                <td className="px-4 py-2"><C>POST /api/v1/dedup/acopio-centers</C></td>
                <td className="px-4 py-2">Centro de acopio</td>
                <td className="px-4 py-2"><C>event_id</C></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 rounded-md bg-blue-50 p-3 text-sm text-blue-900">
          La privacidad es responsabilidad del scraper: envía <C>cedula_hmac</C> y{" "}
          <C>contact_hmac</C> ya hasheados (SHA-256 hex, 64 caracteres) y los
          campos <C>*_masked</C> ya enmascarados. La API <strong>nunca</strong>{" "}
          recibe datos personales en claro. Si una FK no existe, responde{" "}
          <C>404</C>. El contrato completo (campos, enums y rangos) está en{" "}
          <C>docs/api-dedup.md</C>.
        </div>

        <h3 className="mt-5 text-sm font-semibold text-gray-700">
          Ejemplo end-to-end (evento → persona → nota)
        </h3>
        <div className="mt-2">
          <CodeTabs samples={dedupSamples} />
        </div>
      </section>

      <p className="mt-10 text-xs text-gray-400">
        Reemplaza <C>{BASE}</C> por el dominio de producción cuando corresponda.
      </p>
    </main>
  );
}
