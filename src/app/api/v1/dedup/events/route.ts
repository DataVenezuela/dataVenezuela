import { createIngestHandler } from "@/lib/dedup/handler";
import { eventInputSchema } from "@/lib/dedup/validation";
import { createEvent } from "@/lib/dedup/service";

export const POST = createIngestHandler(
  eventInputSchema,
  createEvent,
  "/api/v1/dedup/events",
);
