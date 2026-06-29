import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { ensureOwnerSource } from "@/lib/sources";

type MaybeSingle = { data: unknown };

function makeSupabase(opts: { maybeSingleQueue: MaybeSingle[] }) {
  const queue = [...opts.maybeSingleQueue];
  const captured: { sources: Record<string, unknown>[] } = { sources: [] };
  const client = {
    from: () => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        limit: () => builder,
        maybeSingle: () => Promise.resolve(queue.shift() ?? { data: null }),
        insert: (payload: Record<string, unknown>) => {
          captured.sources.push(payload);
          return Promise.resolve({ error: null });
        },
      };
      return builder;
    },
  };
  return { client, captured };
}

beforeEach(() => vi.clearAllMocks());

describe("ensureOwnerSource", () => {
  it("no crea fuente si el owner ya tiene una (idempotente)", async () => {
    const { client, captured } = makeSupabase({
      maybeSingleQueue: [{ data: { id: "src-1" } }],
    });
    await ensureOwnerSource(client as never, "owner-1", "Mi fuente");
    expect(captured.sources).toHaveLength(0);
  });

  it("crea una fuente con slug único y sin website si no tiene ninguna", async () => {
    const { client, captured } = makeSupabase({
      // 1) sin fuente previa · 2) slug libre
      maybeSingleQueue: [{ data: null }, { data: null }],
    });
    await ensureOwnerSource(client as never, "owner-1", "Admin Uno");
    expect(captured.sources).toHaveLength(1);
    expect(captured.sources[0]).toMatchObject({
      owner_id: "owner-1",
      name: "Admin Uno",
      slug: "admin-uno",
      website: null,
    });
  });
});
