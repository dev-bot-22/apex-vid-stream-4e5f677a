// Admin server functions — password login, log listing, block CRUD.
import { createServerFn } from "@tanstack/react-start";

async function requireAdmin() {
  const { getAdminSession } = await import("./admin.server");
  const session = await getAdminSession();
  if (!session.data.authed) throw new Error("Unauthorized");
  return session;
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { getAdminSession, passwordMatches } = await import("./admin.server");
    const expected = process.env.ADMIN_PASSWORD || "";
    if (!expected) return { ok: false as const, reason: "not-configured" };
    if (!passwordMatches(data.password, expected))
      return { ok: false as const, reason: "invalid" };
    const session = await getAdminSession();
    await session.update({ authed: true, loginAt: Date.now() });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { getAdminSession } = await import("./admin.server");
  const session = await getAdminSession();
  await session.clear();
  return { ok: true as const };
});

export const adminMe = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminSession } = await import("./admin.server");
  const session = await getAdminSession();
  return { authed: !!session.data.authed };
});

export const listAccessLogs = createServerFn({ method: "GET" })
  .inputValidator((data: { limit?: number; kind?: string; ip?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    await requireAdmin();
    const { admin } = await import("./admin.server");
    let q = admin()
      .from("access_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit || 200, 1000));
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.ip) q = q.eq("ip", data.ip);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { rows: rows || [] };
  });

export const listBlocks = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { admin } = await import("./admin.server");
  const { data, error } = await admin()
    .from("blocked_clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { rows: data || [] };
});

export const addBlock = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { kind: string; value: string; message?: string }) => data,
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { admin, invalidateBlockCache } = await import("./admin.server");
    const kind = data.kind.trim();
    const value = data.value.trim();
    if (!value) throw new Error("Value required");
    if (!["ip", "referer", "origin", "user_agent", "batch_id"].includes(kind))
      throw new Error("Invalid kind");
    const { error } = await admin()
      .from("blocked_clients")
      .upsert(
        { kind, value, message: data.message?.trim() || null },
        { onConflict: "kind,value" },
      );
    if (error) throw error;
    invalidateBlockCache();
    return { ok: true as const };
  });

export const removeBlock = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { admin, invalidateBlockCache } = await import("./admin.server");
    const { error } = await admin().from("blocked_clients").delete().eq("id", data.id);
    if (error) throw error;
    invalidateBlockCache();
    return { ok: true as const };
  });

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { admin } = await import("./admin.server");
  const { data, error } = await admin().from("admin_settings").select("*");
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const row of (data || []) as Array<{ key: string; value: string }>)
    out[row.key] = row.value;
  return out;
});

export const setBlockMessage = createServerFn({ method: "POST" })
  .inputValidator((data: { message: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { admin } = await import("./admin.server");
    const { error } = await admin()
      .from("admin_settings")
      .upsert({ key: "block_message", value: data.message });
    if (error) throw error;
    return { ok: true as const };
  });

export const clearLogs = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { admin } = await import("./admin.server");
  const { error } = await admin().from("access_logs").delete().gt("id", 0);
  if (error) throw error;
  return { ok: true as const };
});

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { admin } = await import("./admin.server");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin()
    .from("access_logs")
    .select("ip,referer,kind,blocked,created_at")
    .gte("created_at", since)
    .limit(5000);
  if (error) throw error;
  const rows = (data || []) as Array<{
    ip: string; referer: string; kind: string; blocked: boolean;
  }>;
  const byIp: Record<string, number> = {};
  const byRef: Record<string, number> = {};
  let blocked = 0;
  for (const r of rows) {
    if (r.ip) byIp[r.ip] = (byIp[r.ip] || 0) + 1;
    if (r.referer) byRef[r.referer] = (byRef[r.referer] || 0) + 1;
    if (r.blocked) blocked++;
  }
  const top = (obj: Record<string, number>) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 15);
  return {
    total24h: rows.length,
    blocked24h: blocked,
    topIps: top(byIp),
    topReferers: top(byRef),
  };
});
