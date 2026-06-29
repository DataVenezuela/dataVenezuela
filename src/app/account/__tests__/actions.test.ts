import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/auth")>();
  return { ...actual, getSessionProfile: vi.fn() };
});

import { getSessionProfile, type SessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestAdminApiKeyAction } from "@/app/account/actions";

const sessionMock = vi.mocked(getSessionProfile);
const adminMock = vi.mocked(createAdminClient);

type MaybeSingle = { data: unknown };

function makeSupabase(opts: { maybeSingleQueue: MaybeSingle[] }) {
  const queue = [...opts.maybeSingleQueue];
  const captured: Record<string, Record<string, unknown>[]> = {
    sources: [],
    partner_api_keys: [],
  };
  const client = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        limit: () => builder,
        maybeSingle: () => Promise.resolve(queue.shift() ?? { data: null }),
        insert: (payload: Record<string, unknown>) => {
          (captured[table] ??= []).push(payload);
          return Promise.resolve({ error: null });
        },
      };
      return builder;
    },
  };
  return { client, captured };
}

const ADMIN: SessionProfile = {
  userId: "admin-1",
  email: "admin@x.org",
  fullName: "Admin Uno",
  role: "admin",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requestAdminApiKeyAction", () => {
  it("rechaza a un no-admin sin crear nada", async () => {
    sessionMock.mockResolvedValue({ ...ADMIN, role: "scraper" });
    const res = await requestAdminApiKeyAction();
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(adminMock).not.toHaveBeenCalled();
  });

  it("auto-crea fuente y key para un admin sin fuente previa", async () => {
    sessionMock.mockResolvedValue(ADMIN);
    const { client, captured } = makeSupabase({
      // 1) sin fuente previa · 2) slug libre
      maybeSingleQueue: [{ data: null }, { data: null }],
    });
    adminMock.mockReturnValue(client as never);

    const res = await requestAdminApiKeyAction();

    expect(res.ok).toBe(true);
    expect(res.key).toMatch(/^dv_/);
    expect(captured.sources).toHaveLength(1);
    expect(captured.sources[0]).toMatchObject({ owner_id: "admin-1", website: null });
    expect(captured.partner_api_keys).toHaveLength(1);
    expect(captured.partner_api_keys[0]).toMatchObject({
      owner_id: "admin-1",
      active: true,
    });
    expect(captured.partner_api_keys[0].name).toBeTruthy();
    expect(captured.partner_api_keys[0].key_hash).toBeTruthy();
  });

  it("no crea otra fuente si el admin ya tiene una", async () => {
    sessionMock.mockResolvedValue(ADMIN);
    const { client, captured } = makeSupabase({
      maybeSingleQueue: [{ data: { id: "src-1" } }], // fuente existente
    });
    adminMock.mockReturnValue(client as never);

    const res = await requestAdminApiKeyAction();

    expect(res.ok).toBe(true);
    expect(captured.sources).toHaveLength(0);
    expect(captured.partner_api_keys).toHaveLength(1);
  });
});
