import { createIngestHandler } from "@/lib/dedup/handler";
import { personSourceInputSchema } from "@/lib/dedup/validation";
import { createPersonSource } from "@/lib/dedup/service";

export const POST = createIngestHandler(
  personSourceInputSchema,
  createPersonSource,
  "/api/v1/dedup/person-sources",
);
