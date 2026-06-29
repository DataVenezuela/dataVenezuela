"use client";

import { useActionState } from "react";
import { requestAdminApiKeyAction, type CreateKeyState } from "./actions";
import { btnPrimary } from "@/lib/ui";

const initial: CreateKeyState = { ok: false };

export function RequestAdminKeyForm() {
  const [state, formAction, pending] = useActionState(
    requestAdminApiKeyAction,
    initial,
  );

  return (
    <div className="space-y-3">
      {state.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </div>
      )}
      {state.ok && state.key && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">
            Copia tu API key ahora. No volverá a mostrarse.
          </p>
          <code className="mt-2 block break-all rounded bg-white px-2 py-1 font-mono text-xs text-gray-900">
            {state.key}
          </code>
          <p className="mt-2 text-xs text-amber-800">
            Úsala en el header <code>x-api-key</code> al subir datos.
          </p>
        </div>
      )}

      <form action={formAction}>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Generando…" : "Solicitar API key"}
        </button>
      </form>
    </div>
  );
}
