import { createIngestHandler } from "@/lib/dedup/handler";
import { personNoteInputSchema } from "@/lib/dedup/validation";
import { createPersonNote } from "@/lib/dedup/service";

export const POST = createIngestHandler(
  personNoteInputSchema,
  createPersonNote,
  "/api/v1/dedup/person-notes",
);
