import type { Env } from "./env";
import { Router, json } from "./router";
import { handleHealthz } from "./routes/healthz";

const router = new Router().get("/healthz", async (_request, env) =>
  json(await handleHealthz(env)),
);

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router.handle(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
