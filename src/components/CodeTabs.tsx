"use client";

import { useState } from "react";

export type CodeSample = { label: string; code: string };

/**
 * Bloque de código con pestañas por lenguaje y botón "Copiar".
 * Client Component: maneja la pestaña activa y el portapapeles.
 */
export function CodeTabs({ samples }: { samples: CodeSample[] }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(samples[active].code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // El portapapeles puede no estar disponible (p. ej. sin HTTPS); se ignora.
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-2">
        <div className="flex">
          {samples.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setActive(i)}
              className={`px-3 py-2 text-xs font-medium transition ${
                i === active
                  ? "border-b-2 border-white text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
        >
          {copied ? "¡Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-gray-100">
        <code>{samples[active].code}</code>
      </pre>
    </div>
  );
}
