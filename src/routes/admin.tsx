import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  adminLogin,
  adminLogout,
  adminMe,
  listAccessLogs,
  listBlocks,
  addBlock,
  removeBlock,
  getSettings,
  setBlockMessage,
  clearLogs,
  getStats,
} from "../lib/admin.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin — ApexLecture" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

type LogRow = {
  id: number;
  created_at: string;
  kind: string;
  path: string;
  ip: string;
  user_agent: string;
  referer: string;
  origin: string;
  batch_id: string | null;
  video_id: string | null;
  video_name: string | null;
  blocked: boolean;
};
type BlockRow = {
  id: number;
  created_at: string;
  kind: string;
  value: string;
  message: string | null;
};
type Stats = {
  total24h: number;
  blocked24h: number;
  topIps: Array<[string, number]>;
  topReferers: Array<[string, number]>;
};

function AdminPage() {
  const router = useRouter();
  const login = useServerFn(adminLogin);
  const logout = useServerFn(adminLogout);
  const me = useServerFn(adminMe);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    me().then((r) => setAuthed(r.authed)).catch(() => setAuthed(false));
  }, [me]);

  if (authed === null)
    return <div style={styles.center}>Loading…</div>;

  if (!authed) {
    return (
      <div style={styles.center}>
        <form
          style={styles.card}
          onSubmit={async (e) => {
            e.preventDefault();
            setErr("");
            const r = await login({ data: { password } });
            if (r.ok) {
              setAuthed(true);
              router.invalidate();
            } else setErr("Invalid password");
          }}
        >
          <h1 style={{ margin: "0 0 12px", fontSize: 20 }}>Admin Login</h1>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            autoFocus
          />
          <button type="submit" style={styles.btn}>
            Sign in
          </button>
          {err && <p style={{ color: "#f66", marginTop: 8 }}>{err}</p>}
        </form>
      </div>
    );
  }

  return (
    <Dashboard
      onLogout={async () => {
        await logout();
        setAuthed(false);
      }}
    />
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const loadLogs = useServerFn(listAccessLogs);
  const loadBlocks = useServerFn(listBlocks);
  const loadSettings = useServerFn(getSettings);
  const loadStats = useServerFn(getStats);
  const add = useServerFn(addBlock);
  const del = useServerFn(removeBlock);
  const saveMsg = useServerFn(setBlockMessage);
  const clear = useServerFn(clearLogs);

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [filterIp, setFilterIp] = useState("");
  const [tab, setTab] = useState<"logs" | "blocks" | "settings" | "stats">("logs");

  const [nk, setNk] = useState("ip");
  const [nv, setNv] = useState("");
  const [nm, setNm] = useState("");

  async function refresh() {
    const [l, b, s, st] = await Promise.all([
      loadLogs({ data: { limit: 300, ip: filterIp || undefined } }),
      loadBlocks(),
      loadSettings(),
      loadStats(),
    ]);
    setLogs(l.rows as LogRow[]);
    setBlocks(b.rows as BlockRow[]);
    setMessage(s.block_message || "");
    setStats(st);
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterIp]);

  return (
    <div style={{ background: "#0b0b12", minHeight: "100vh", color: "#eee" }}>
      <header style={styles.header}>
        <strong>ApexLecture Admin</strong>
        <div style={{ display: "flex", gap: 8 }}>
          {(["logs", "blocks", "settings", "stats"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
            >
              {t}
            </button>
          ))}
          <button onClick={onLogout} style={styles.btnGhost}>
            Logout
          </button>
        </div>
      </header>

      <main style={{ padding: 16, maxWidth: 1400, margin: "0 auto" }}>
        {tab === "stats" && stats && (
          <div style={styles.grid}>
            <StatCard label="Requests (24h)" value={stats.total24h} />
            <StatCard label="Blocked (24h)" value={stats.blocked24h} />
            <div style={styles.card}>
              <h3 style={styles.h3}>Top IPs (24h)</h3>
              {stats.topIps.map(([k, v]) => (
                <div key={k} style={styles.rowLine}>
                  <code>{k}</code>
                  <span>{v}</span>
                  <button
                    style={styles.small}
                    onClick={async () => {
                      await add({ data: { kind: "ip", value: k } });
                      refresh();
                    }}
                  >
                    Block
                  </button>
                </div>
              ))}
            </div>
            <div style={styles.card}>
              <h3 style={styles.h3}>Top Referers (24h)</h3>
              {stats.topReferers.map(([k, v]) => (
                <div key={k} style={styles.rowLine}>
                  <code style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {k}
                  </code>
                  <span>{v}</span>
                  <button
                    style={styles.small}
                    onClick={async () => {
                      try {
                        const host = new URL(k).host;
                        await add({ data: { kind: "referer", value: host } });
                        refresh();
                      } catch {
                        await add({ data: { kind: "referer", value: k } });
                        refresh();
                      }
                    }}
                  >
                    Block host
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "logs" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                placeholder="Filter by IP"
                value={filterIp}
                onChange={(e) => setFilterIp(e.target.value)}
                style={styles.input}
              />
              <button style={styles.btnGhost} onClick={refresh}>
                Refresh
              </button>
              <button
                style={styles.btnGhost}
                onClick={async () => {
                  if (confirm("Clear all access logs?")) {
                    await clear();
                    refresh();
                  }
                }}
              >
                Clear logs
              </button>
            </div>
            <div style={{ overflow: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>IP</th>
                    <th>Referer</th>
                    <th>Origin</th>
                    <th>Batch / Video</th>
                    <th>UA</th>
                    <th>Blocked</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((r) => (
                    <tr key={r.id} style={r.blocked ? { background: "#3a0000" } : undefined}>
                      <td>{new Date(r.created_at).toLocaleString()}</td>
                      <td>{r.kind}</td>
                      <td><code>{r.ip}</code></td>
                      <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.referer}
                      </td>
                      <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.origin}
                      </td>
                      <td>
                        {r.batch_id || ""} {r.video_id ? `/ ${r.video_id}` : ""}
                        {r.video_name ? <div style={{ opacity: 0.6, fontSize: 11 }}>{r.video_name}</div> : null}
                      </td>
                      <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", fontSize: 11 }}>
                        {r.user_agent}
                      </td>
                      <td>{r.blocked ? "🚫" : ""}</td>
                      <td>
                        {r.ip && (
                          <button
                            style={styles.small}
                            onClick={async () => {
                              await add({ data: { kind: "ip", value: r.ip } });
                              refresh();
                            }}
                          >
                            Block IP
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && (
                <p style={{ opacity: 0.6, marginTop: 12 }}>No requests logged yet.</p>
              )}
            </div>
          </div>
        )}

        {tab === "blocks" && (
          <div>
            <div style={styles.card}>
              <h3 style={styles.h3}>Add block rule</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select value={nk} onChange={(e) => setNk(e.target.value)} style={styles.input}>
                  <option value="ip">IP (exact)</option>
                  <option value="referer">Referer (substring)</option>
                  <option value="origin">Origin (substring)</option>
                  <option value="user_agent">User-Agent (substring)</option>
                  <option value="batch_id">Batch ID (exact)</option>
                </select>
                <input
                  placeholder="Value"
                  value={nv}
                  onChange={(e) => setNv(e.target.value)}
                  style={{ ...styles.input, minWidth: 240 }}
                />
                <input
                  placeholder="Custom message (optional)"
                  value={nm}
                  onChange={(e) => setNm(e.target.value)}
                  style={{ ...styles.input, minWidth: 300 }}
                />
                <button
                  style={styles.btn}
                  onClick={async () => {
                    if (!nv.trim()) return;
                    await add({ data: { kind: nk, value: nv, message: nm || undefined } });
                    setNv("");
                    setNm("");
                    refresh();
                  }}
                >
                  Add
                </button>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Value</th>
                    <th>Custom message</th>
                    <th>Added</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((b) => (
                    <tr key={b.id}>
                      <td>{b.kind}</td>
                      <td><code>{b.value}</code></td>
                      <td style={{ maxWidth: 400 }}>{b.message}</td>
                      <td>{new Date(b.created_at).toLocaleString()}</td>
                      <td>
                        <button
                          style={styles.small}
                          onClick={async () => {
                            await del({ data: { id: b.id } });
                            refresh();
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {blocks.length === 0 && (
                <p style={{ opacity: 0.6, marginTop: 12 }}>No block rules yet.</p>
              )}
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div style={styles.card}>
            <h3 style={styles.h3}>Default block message</h3>
            <p style={{ opacity: 0.7, fontSize: 13 }}>
              Shown when a request is blocked and the rule has no custom message.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              style={{ ...styles.input, width: "100%", fontFamily: "inherit" }}
            />
            <button
              style={{ ...styles.btn, marginTop: 8 }}
              onClick={async () => {
                await saveMsg({ data: { message } });
                alert("Saved");
              }}
            >
              Save
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.card}>
      <div style={{ opacity: 0.6, fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0b0b12",
    color: "#eee",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    background: "#15151f",
    border: "1px solid #2a2a3a",
    borderRadius: 8,
    padding: 16,
  },
  input: {
    background: "#0b0b12",
    color: "#eee",
    border: "1px solid #2a2a3a",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 14,
  },
  btn: {
    background: "#4f46e5",
    color: "#fff",
    border: 0,
    borderRadius: 6,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 600,
  },
  btnGhost: {
    background: "transparent",
    color: "#eee",
    border: "1px solid #2a2a3a",
    borderRadius: 6,
    padding: "6px 12px",
    cursor: "pointer",
  },
  small: {
    background: "#7a1f1f",
    color: "#fff",
    border: 0,
    borderRadius: 4,
    padding: "4px 8px",
    cursor: "pointer",
    fontSize: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #2a2a3a",
    background: "#0f0f18",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  tab: {
    background: "transparent",
    color: "#aaa",
    border: "1px solid #2a2a3a",
    borderRadius: 6,
    padding: "6px 12px",
    cursor: "pointer",
    textTransform: "capitalize",
  },
  tabActive: { background: "#4f46e5", color: "#fff", borderColor: "#4f46e5" },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
    background: "#15151f",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 12,
  },
  h3: { margin: "0 0 12px", fontSize: 15 },
  rowLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    padding: "6px 0",
    borderBottom: "1px solid #2a2a3a",
    fontSize: 12,
  },
};
