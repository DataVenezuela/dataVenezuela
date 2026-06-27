import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AcopioCenterInput,
  EventInput,
  PersonInput,
  PersonNoteInput,
  PersonPhotoInput,
  PersonSourceInput,
} from "@/lib/dedup/validation";

type Admin = ReturnType<typeof createAdminClient>;

export type CreateResult = { id: string };

/** Una FK del payload apunta a un registro que no existe (→ 404). */
export class ReferenceNotFoundError extends Error {
  constructor(
    public field: string,
    public value: string,
  ) {
    super(`La referencia ${field}=${value} no existe`);
    this.name = "ReferenceNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Validación de FKs en capa API (además de la constraint DB). Es una verificación
// "best-effort": la constraint 23503 es el guardia real ante carreras.
// ---------------------------------------------------------------------------
async function eventExists(supabase: Admin, id: string): Promise<boolean> {
  const { data } = await supabase
    .from("events")
    .select("event_id")
    .eq("event_id", id)
    .maybeSingle();
  return Boolean(data);
}

async function personExists(supabase: Admin, id: string): Promise<boolean> {
  const { data } = await supabase
    .from("persons")
    .select("person_record_id")
    .eq("person_record_id", id)
    .maybeSingle();
  return Boolean(data);
}

async function personSourceExists(supabase: Admin, id: string): Promise<boolean> {
  const { data } = await supabase
    .from("person_sources")
    .select("source_id")
    .eq("source_id", id)
    .maybeSingle();
  return Boolean(data);
}

/** Traduce la violación de FK de Postgres (23503) a ReferenceNotFoundError. */
function mapInsertError(
  error: { code?: string; message: string },
  fallbackField: string,
  fallbackValue: string,
): never {
  if (error.code === "23503") {
    throw new ReferenceNotFoundError(fallbackField, fallbackValue);
  }
  throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// events
// ---------------------------------------------------------------------------
export async function createEvent(input: EventInput): Promise<CreateResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      name: input.name,
      event_type: input.event_type,
      occurred_at: input.occurred_at,
      affected_states: (input.affected_states ?? null) as never,
      magnitude: input.magnitude ?? null,
      depth_km: input.depth_km ?? null,
      status: input.status,
      external_ids: (input.external_ids ?? null) as never,
    })
    .select("event_id")
    .single();
  if (error) mapInsertError(error, "event", "");
  return { id: data!.event_id };
}

// ---------------------------------------------------------------------------
// persons
// ---------------------------------------------------------------------------
export async function createPerson(input: PersonInput): Promise<CreateResult> {
  const supabase = createAdminClient();
  if (!(await eventExists(supabase, input.event_id))) {
    throw new ReferenceNotFoundError("event_id", input.event_id);
  }
  const { data, error } = await supabase
    .from("persons")
    .insert({
      event_id: input.event_id,
      full_name: input.full_name ?? null,
      alternate_names: (input.alternate_names ?? null) as never,
      cedula_hmac: input.cedula_hmac ?? null,
      cedula_masked: input.cedula_masked ?? null,
      age_range: (input.age_range ?? null) as never,
      sex: input.sex ?? null,
      is_minor: input.is_minor ?? null,
      last_known_location: (input.last_known_location ?? null) as never,
      status: input.status,
      verification_status: input.verification_status,
      confidence_score: input.confidence_score ?? undefined,
      source_url: input.source_url ?? null,
    })
    .select("person_record_id")
    .single();
  if (error) mapInsertError(error, "event_id", input.event_id);
  return { id: data!.person_record_id };
}

// ---------------------------------------------------------------------------
// person_notes
// ---------------------------------------------------------------------------
export async function createPersonNote(
  input: PersonNoteInput,
): Promise<CreateResult> {
  const supabase = createAdminClient();
  if (!(await personExists(supabase, input.person_record_id))) {
    throw new ReferenceNotFoundError("person_record_id", input.person_record_id);
  }
  const { data, error } = await supabase
    .from("person_notes")
    .insert({
      person_record_id: input.person_record_id,
      note_type: input.note_type,
      found_by: input.found_by ?? null,
      status: input.status,
      source_date: input.source_date ?? null,
      entry_date: input.entry_date ?? undefined,
      found: input.found ?? null,
      last_known_location: (input.last_known_location ?? null) as never,
      last_seen_at: input.last_seen_at ?? null,
      last_seen_location: (input.last_seen_location ?? null) as never,
      hospital_name: input.hospital_name ?? null,
      hospital_municipio: input.hospital_municipio ?? null,
      severity: input.severity ?? null,
      admitted_time: input.admitted_time ?? null,
      found_at: input.found_at ?? null,
      deceased_at: input.deceased_at ?? null,
      recovery_location: (input.recovery_location ?? null) as never,
      identification_status: input.identification_status ?? null,
      confirmed_by: input.confirmed_by ?? null,
    })
    .select("note_record_id")
    .single();
  if (error) mapInsertError(error, "person_record_id", input.person_record_id);
  return { id: data!.note_record_id };
}

// ---------------------------------------------------------------------------
// person_sources
// ---------------------------------------------------------------------------
export async function createPersonSource(
  input: PersonSourceInput,
): Promise<CreateResult> {
  const supabase = createAdminClient();
  if (!(await personExists(supabase, input.person_record_id))) {
    throw new ReferenceNotFoundError("person_record_id", input.person_record_id);
  }
  const { data, error } = await supabase
    .from("person_sources")
    .insert({
      person_record_id: input.person_record_id,
      source_url: input.source_url,
      ext_id: input.ext_id ?? null,
      trust_tier: input.trust_tier,
      fetched_at: input.fetched_at ?? undefined,
    })
    .select("source_id")
    .single();
  if (error) mapInsertError(error, "person_record_id", input.person_record_id);
  return { id: data!.source_id };
}

// ---------------------------------------------------------------------------
// person_photos
// ---------------------------------------------------------------------------
export async function createPersonPhoto(
  input: PersonPhotoInput,
): Promise<CreateResult> {
  const supabase = createAdminClient();
  if (!(await personExists(supabase, input.person_record_id))) {
    throw new ReferenceNotFoundError("person_record_id", input.person_record_id);
  }
  if (input.source_id && !(await personSourceExists(supabase, input.source_id))) {
    throw new ReferenceNotFoundError("source_id", input.source_id);
  }
  const { data, error } = await supabase
    .from("person_photos")
    .insert({
      person_record_id: input.person_record_id,
      url: input.url,
      caption: input.caption ?? null,
      source_id: input.source_id ?? null,
      uploaded_at: input.uploaded_at ?? undefined,
    })
    .select("photo_id")
    .single();
  if (error) mapInsertError(error, "person_record_id", input.person_record_id);
  return { id: data!.photo_id };
}

// ---------------------------------------------------------------------------
// acopio_centers
// ---------------------------------------------------------------------------
export async function createAcopioCenter(
  input: AcopioCenterInput,
): Promise<CreateResult> {
  const supabase = createAdminClient();
  if (!(await eventExists(supabase, input.event_id))) {
    throw new ReferenceNotFoundError("event_id", input.event_id);
  }
  const { data, error } = await supabase
    .from("acopio_centers")
    .insert({
      event_id: input.event_id,
      name: input.name,
      location: (input.location ?? null) as never,
      confidence_score: input.confidence_score ?? undefined,
      status: input.status,
      needs: (input.needs ?? null) as never,
      last_verified_at: input.last_verified_at ?? null,
      managing_org: input.managing_org ?? null,
      contact_hmac: input.contact_hmac ?? null,
      contact_masked: input.contact_masked ?? null,
      capacity: input.capacity ?? null,
      current_load: input.current_load ?? null,
    })
    .select("acopio_id")
    .single();
  if (error) mapInsertError(error, "event_id", input.event_id);
  return { id: data!.acopio_id };
}
