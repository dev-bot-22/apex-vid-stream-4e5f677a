// Server-only helpers for admin session, logging, and block enforcement.
// Uses Supabase service role (RLS bypassed) — never import into client code.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

export type AdminSession = { authed?: boolean; loginAt?: number };

export function sessionConfig() {
  return {
    password: process.env.SESSION_SECRET!,
    name: "apex-admin",
    maxAge: 60 * 60 * 8, // 8h
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function getAdminSession() {
  return useSession<AdminSession>(sessionConfig());
}

export function passwordMatches(input: string, expected: string): boolean {
  if (!expected) return false;
  const a = createHash("sha256").update(input || "", "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

let _client: SupabaseClient | null = null;
export function admin(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _client;
}

export interface ClientInfo {
  ip: string;
  user_agent: string;
  referer: string;
  origin: string;
}

export function extractClient(request: Request): ClientInfo {
  const h = request.headers;
  const ip =
    h.get("cf-connecting-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "";
  return {
    ip,
    user_agent: h.get("user-agent") || "",
    referer: h.get("referer") || "",
    origin: h.get("origin") || "",
  };
}

// Cache blocklist for 30s to avoid a DB hit per request.
type BlockRow = { kind: string; value: string; message: string | null };
let blockCache: { at: number; rows: BlockRow[] } | null = null;

export async function getBlocks(): Promise<BlockRow[]> {
  const now = Date.now();
  if (blockCache && now - blockCache.at < 30_000) return blockCache.rows;
  const { data } = await admin()
    .from("blocked_clients")
    .select("kind,value,message");
  blockCache = { at: now, rows: (data as BlockRow[]) || [] };
  return blockCache.rows;
}

export function invalidateBlockCache() {
  blockCache = null;
}

export async function getBlockMessage(): Promise<string> {
  const { data } = await admin()
    .from("admin_settings")
    .select("value")
    .eq("key", "block_message")
    .maybeSingle();
  return (
    (data?.value as string) ||
    "Access denied. This player is protected."
  );
}

export interface BlockMatch {
  matched: boolean;
  reason?: string;
  message?: string | null;
}

export async function checkBlocked(params: {
  client: ClientInfo;
  batch_id?: string;
}): Promise<BlockMatch> {
  const rows = await getBlocks();
  const c = params.client;
  for (const r of rows) {
    const v = (r.value || "").toLowerCase();
    if (!v) continue;
    let hit = false;
    if (r.kind === "ip" && c.ip && c.ip.toLowerCase() === v) hit = true;
    else if (r.kind === "referer" && c.referer && c.referer.toLowerCase().includes(v))
      hit = true;
    else if (r.kind === "origin" && c.origin && c.origin.toLowerCase().includes(v))
      hit = true;
    else if (
      r.kind === "user_agent" &&
      c.user_agent &&
      c.user_agent.toLowerCase().includes(v)
    )
      hit = true;
    else if (
      r.kind === "batch_id" &&
      params.batch_id &&
      params.batch_id.toLowerCase() === v
    )
      hit = true;
    if (hit)
      return { matched: true, reason: `${r.kind}=${r.value}`, message: r.message };
  }
  return { matched: false };
}

export async function logAccess(entry: {
  kind: string; // 'play' | 'play2' | 'home' etc.
  path: string;
  method: string;
  client: ClientInfo;
  batch_id?: string;
  video_id?: string;
  video_name?: string;
  blocked?: boolean;
}) {
  try {
    await admin()
      .from("access_logs")
      .insert({
        kind: entry.kind,
        path: entry.path,
        method: entry.method,
        ip: entry.client.ip,
        user_agent: entry.client.user_agent,
        referer: entry.client.referer,
        origin: entry.client.origin,
        batch_id: entry.batch_id ?? null,
        video_id: entry.video_id ?? null,
        video_name: entry.video_name ?? null,
        blocked: !!entry.blocked,
      });
  } catch (e) {
    console.error("[access-log] insert failed", e);
  }
}

export function blockPageHtml(message: string): string {
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access Denied</title><style>
html,body{margin:0;height:100%;background:#0b0b12;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
.box{max-width:520px}
h1{font-size:22px;margin:0 0 12px;color:#ff6a6a}
p{opacity:.85;line-height:1.5;white-space:pre-wrap}
</style></head><body><div class="box"><h1>🚫 Blocked</h1><p>${safe}</p></div></body></html>`;
}
