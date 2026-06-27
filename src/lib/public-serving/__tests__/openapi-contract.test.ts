import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const contract = JSON.parse(
  readFileSync(join(process.cwd(), "docs/openapi-public-serving.json"), "utf8"),
);

describe("public serving OpenAPI contract", () => {
  it("declara los endpoints acordados para Worker/D1", () => {
    expect(Object.keys(contract.paths).sort()).toEqual([
      "/healthz",
      "/v1/acopio",
      "/v1/events",
      "/v1/personas",
      "/v1/personas/{person_record_id}",
    ]);
  });

  it("no expone campos sensibles en respuestas HTTP", () => {
    const forbiddenFields = [
      "cedula_hmac",
      "contact_hmac",
      "raw_json",
      "raw_text",
      "scraper_id",
      "partner_api_keys",
    ];

    const serialized = JSON.stringify(contract);
    for (const field of forbiddenFields) {
      expect(serialized).not.toContain(`"${field}"`);
    }
  });

  it("limita busqueda de personas para reducir enumeracion", () => {
    const params = contract.paths["/v1/personas"].get.parameters;
    const nombre = params.find((param: { name: string }) => param.name === "nombre");
    const limit = params.find((param: { name: string }) => param.name === "limit");

    if (!nombre || !limit) {
      throw new Error("El contrato debe declarar los parametros nombre y limit");
    }

    expect(nombre.required).toBe(true);
    expect(nombre.schema.minLength).toBe(3);
    expect(limit.schema.minimum).toBe(1);
    expect(limit.schema.maximum).toBe(20);
  });
});
