import { createAdminClient } from "@/lib/supabase/admin";
import { SourceOwnershipError } from "@/lib/services/aportes";
import type { QuarantineInput } from "@/lib/validation";

export async function createQuarantineRecord(
  input: QuarantineInput,
  { scraperId }: { scraperId: string },
): Promise<string> {
  const supabase = createAdminClient();

  const { data: source } = await supabase
    .from("sources")
    .select("slug")
    .eq("owner_id", scraperId)
    .eq("slug", input.sourceSlug)
    .maybeSingle();
  if (!source) throw new SourceOwnershipError();

  const { data, error } = await supabase
    .from("quarantine_records")
    .insert({
      run_id: input.runId ?? null,
      source_slug: input.sourceSlug,
      source_url: input.sourceUrl ?? null,
      reason_code: input.reasonCode,
      reason_detail: input.reasonDetail ?? null,
      risk_level: input.riskLevel,
      payload_preview_redacted: input.payloadPreviewRedacted ?? null,
      payload_hash: input.payloadHash ?? null,
      pii_findings_summary: (input.piiFindingsSummary ?? null) as never,
      retention_until: input.retentionUntil ?? null,
    })
    .select("quarantine_id")
    .single();

  if (error) throw new Error(`createQuarantineRecord failed: ${error.message}`);
  return data.quarantine_id;
}
