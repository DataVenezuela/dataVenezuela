import { createIngestHandler } from "@/lib/dedup/handler";
import { acopioCenterInputSchema } from "@/lib/dedup/validation";
import { createAcopioCenter } from "@/lib/dedup/service";

export const POST = createIngestHandler(
  acopioCenterInputSchema,
  createAcopioCenter,
  "/api/v1/dedup/acopio-centers",
);
