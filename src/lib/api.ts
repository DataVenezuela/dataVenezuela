import type { ZodError } from "zod";

export function jsonError(message: string, status = 400, extra?: object) {
  return Response.json({ error: message, ...extra }, { status });
}

export function validationError(error: ZodError) {
  return Response.json(
    {
      error: "Datos inválidos",
      issues: error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    },
    { status: 422 },
  );
}

export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
