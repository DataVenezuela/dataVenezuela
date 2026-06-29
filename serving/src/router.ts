import type { Env } from "./env";

export type Handler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => Response | Promise<Response>;

interface Route {
  method: string;
  path: string;
  handler: Handler;
}

// Router minimo por (metodo, path exacto). Los path params (ej. /v1/personas/{id})
// llegan en specs posteriores; por ahora solo rutas exactas.
export class Router {
  private routes: Route[] = [];

  get(path: string, handler: Handler): this {
    this.routes.push({ method: "GET", path, handler });
    return this;
  }

  async handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    for (const route of this.routes) {
      if (route.method === request.method && route.path === pathname) {
        return route.handler(request, env, ctx);
      }
    }
    return json({ error: "not_found" }, { status: 404 });
  }
}

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}
