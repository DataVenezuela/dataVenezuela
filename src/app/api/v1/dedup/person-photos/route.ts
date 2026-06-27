import { createIngestHandler } from "@/lib/dedup/handler";
import { personPhotoInputSchema } from "@/lib/dedup/validation";
import { createPersonPhoto } from "@/lib/dedup/service";

export const POST = createIngestHandler(
  personPhotoInputSchema,
  createPersonPhoto,
  "/api/v1/dedup/person-photos",
);
