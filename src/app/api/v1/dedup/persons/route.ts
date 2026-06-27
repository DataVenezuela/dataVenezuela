import { createIngestHandler } from "@/lib/dedup/handler";
import { personInputSchema } from "@/lib/dedup/validation";
import { createPerson } from "@/lib/dedup/service";

export const POST = createIngestHandler(
  personInputSchema,
  createPerson,
  "/api/v1/dedup/persons",
);
