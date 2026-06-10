"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Button from "@/components/ui/Button";

// ─── Types ──────────────────────────────────────────────────────────────────
interface ContentItem {
  id: string;
  caption: string | null;
  title: string | null;
  platform: string;
  content_type: string | null;
  status: string;
  scheduled_time: string | null;
  media_url: string | null;
  created_at: string;
}

const PLATFORM_META: Record<string, { icon: string; label: string; dot: string; text: string }> = {
  instagram: { icon: "📸", label: "Instagram", dot: "bg-fuchsia-500", text: "text-fuchsia-400" },
  facebook:  { icon: "👤", label: "Facebook",  dot: "bg-blue-500",    text: "text-blue-400" },
  x:         { icon: "✕",  label: "X",          dot: "bg-zinc-400",    text: "text-zinc-300" },
  youtube:   { icon: "▶",  label: "YouTube",    dot: "bg-red-500",     text: "text-red-400" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const fmtDayLabel = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
// Convert an ISO string to the value a <input type="datetime-local"> expects (local time).
const toLocalInput = (iso: string | null) => {
  const d = iso ? new Date(iso) : new Date(Date.now() + 24 * 3600 * 1000);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};

export default function ScheduledCalendar() {
  const [posts, setPosts] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedKey, setSelectedKey] = useState<string>(() => dateKey(new Date()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editTime, setEditTime] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scheduler/queue");
      const json = await res.json();
      setPosts(json.data ?? []);
    } catch {
      /* empty state shown */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Posts that have a scheduled time, grouped by local day.
  const byDay = useMemo(() => {
    const map: Record<string, ContentItem[]> = {};
    for (const p of posts) {
      if (!p.scheduled_time) continue;
      const k = dateKey(new Date(p.scheduled_time));
      (map[k] ||= []).push(p);
    }
    for (const k in map) map[k].sort((a, b) => new Date(a.scheduled_time!).getTime() - new Date(b.scheduled_time!).getTime());
    return map;
  }, [posts]);

  const unscheduled = useMemo(() => posts.filter((p) => !p.scheduled_time), [posts]);
  const selectedPosts = byDay[selectedKey] ?? [];

  // Build the month grid (leading blanks + days).
  const cells = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d));
    return out;
  }, [monthCursor]);

  const startEdit = (p: ContentItem) => {
    setEditingId(p.id);
    setEditCaption(p.caption ?? "");
    setEditTime(toLocalInput(p.scheduled_time));
  };

  const saveEdit = async (id: string) => {
    setBusyId(id);
    const scheduled_time = editTime ? new Date(editTime).toISOString() : null;
    try {
      await fetch("/api/scheduler/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, caption: editCaption, scheduled_time, status: scheduled_time ? "scheduled" : "queued" }),
      });
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, caption: editCaption, scheduled_time, status: scheduled_time ? "scheduled" : "queued" } : p)));
      setEditingId(null);
    } finally {
      setBusyId(null);
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm("Delete this scheduled post? This can't be undone.")) return;
    setBusyId(id);
    setPosts((prev) => prev.filter((p) => p.id !== id)); // optimistic
    try {
      await fetch(`/api/scheduler/queue?id=${id}`, { method: "DELETE" });
    } finally {
      setBusyId(null);
    }
  };

  const monthLabel = monthCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayKey = dateKey(new Date());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const scheduledCount = posts.filter((p) => p.scheduled_time).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Scheduled Content</h2>
          <p className="text-xs text-text-muted">{scheduledCount} scheduled · {unscheduled.length} awaiting a time</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load}>↻ Refresh</Button>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-elevated p-10 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-sm font-medium text-text-secondary">No content scheduled yet</p>
          <p className="text-xs text-text-muted mt-1">Queue content from the Schedule tab and it&apos;ll appear here on the calendar.</p>
        </div>
      ) : (
        <>
          {/* ── Month calendar ── */}
          <div className="rounded-2xl border border-border bg-surface-elevated p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 text-text-secondary" aria-label="Previous month">‹</button>
              <p className="text-sm font-semibold text-text-primary">{monthLabel}</p>
              <button onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 text-text-secondary" aria-label="Next month">›</button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-medium text-text-muted py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={`b${i}`} />;
                const k = dateKey(d);
                const dayPosts = byDay[k] ?? [];
                const isSelected = k === selectedKey;
                const isToday = k === todayKey;
                return (
                  <button
                    key={k}
                    onClick={() => setSelectedKey(k)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs transition-colors relative
                      ${isSelected ? "bg-primary/15 border border-primary/40 text-primary"
                        : isToday ? "bg-white/5 border border-white/10 text-text-primary"
                        : "hover:bg-white/5 text-text-secondary border border-transparent"}`}
                  >
                    <span className={`${isToday && !isSelected ? "font-bold" : ""}`}>{d.getDate()}</span>
                    {dayPosts.length > 0 && (
                      <span className="flex items-center gap-0.5">
                        {dayPosts.slice(0, 3).map((p, j) => (
                          <span key={j} className={`w-1.5 h-1.5 rounded-full ${PLATFORM_META[p.platform]?.dot ?? "bg-primary"}`} />
                        ))}
                        {dayPosts.length > 3 && <span className="text-[8px] text-text-muted">+{dayPosts.length - 3}</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Agenda for the selected day ── */}
          <div>
            <p className="text-sm font-semibold text-text-primary mb-2">
              {selectedPosts.length > 0 ? fmtDayLabel(new Date(selectedKey.split("-").map(Number)[0], selectedKey.split("-").map(Number)[1], selectedKey.split("-").map(Number)[2])) : "Nothing scheduled this day"}
            </p>
            <div className="space-y-2">
              {selectedPosts.map((p) => (
                <PostCard key={p.id} post={p} editing={editingId === p.id} busy={busyId === p.id}
                  editCaption={editCaption} editTime={editTime} setEditCaption={setEditCaption} setEditTime={setEditTime}
                  onEdit={() => startEdit(p)} onCancel={() => setEditingId(null)} onSave={() => saveEdit(p.id)} onDelete={() => deletePost(p.id)} />
              ))}
              {selectedPosts.length === 0 && (
                <p className="text-xs text-text-muted py-3">Pick another day with colored dots, or schedule new content from the Schedule tab.</p>
              )}
            </div>
          </div>

          {/* ── Unscheduled queue ── */}
          {unscheduled.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-text-primary mb-2">Awaiting a posting time ({unscheduled.length})</p>
              <div className="space-y-2">
                {unscheduled.map((p) => (
                  <PostCard key={p.id} post={p} editing={editingId === p.id} busy={busyId === p.id}
                    editCaption={editCaption} editTime={editTime} setEditCaption={setEditCaption} setEditTime={setEditTime}
                    onEdit={() => startEdit(p)} onCancel={() => setEditingId(null)} onSave={() => saveEdit(p.id)} onDelete={() => deletePost(p.id)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Media preview (image thumb, video/carousel badge) ───────────────────────
function MediaPreview({ url }: { url: string }) {
  // Carousel media_url is a JSON array of URLs.
  let urls: string[] = [url];
  if (url.startsWith("[")) {
    try { urls = JSON.parse(url); } catch { /* keep as single */ }
  }
  const first = urls[0] ?? "";
  const isVideo = /\.(mp4|mov)$/i.test(first);
  return (
    <div className="mb-2 flex items-center gap-2">
      {isVideo ? (
        <div className="w-14 h-14 rounded-lg bg-surface-elevated border border-border flex items-center justify-center text-lg shrink-0">🎬</div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={first} alt="" className="w-14 h-14 rounded-lg object-cover border border-border shrink-0" />
      )}
      <span className="text-[11px] text-text-muted">
        {urls.length > 1 ? `Carousel · ${urls.length} items` : isVideo ? "Video / Reel" : "Image"}
      </span>
    </div>
  );
}

// ─── Post card (view + inline edit) ───────────────────────────────────────────
function PostCard({
  post, editing, busy, editCaption, editTime, setEditCaption, setEditTime, onEdit, onCancel, onSave, onDelete,
}: {
  post: ContentItem; editing: boolean; busy: boolean;
  editCaption: string; editTime: string;
  setEditCaption: (v: string) => void; setEditTime: (v: string) => void;
  onEdit: () => void; onCancel: () => void; onSave: () => void; onDelete: () => void;
}) {
  const meta = PLATFORM_META[post.platform] ?? { icon: "📄", label: post.platform, dot: "bg-primary", text: "text-primary" };

  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${meta.text}`}>
          <span>{meta.icon}</span> {meta.label}
        </span>
        {post.content_type && (
          <span className="text-[10px] text-text-muted border border-border rounded-full px-2 py-0.5 capitalize">{post.content_type.replace("_", " ")}</span>
        )}
        <span className="text-[11px] text-text-muted ml-auto">
          {post.scheduled_time ? fmtTime(post.scheduled_time) : "No time set"}
        </span>
      </div>

      {editing ? (
        <div className="space-y-2.5">
          <textarea
            value={editCaption}
            onChange={(e) => setEditCaption(e.target.value)}
            rows={3}
            placeholder="Caption…"
            className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary/40 resize-none"
          />
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Scheduled time</label>
            <input
              type="datetime-local"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary/40"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" loading={busy} onClick={onSave} className="flex-1">Save</Button>
            <Button variant="secondary" size="sm" onClick={onCancel} className="flex-1">Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          {post.media_url && <MediaPreview url={post.media_url} />}
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap line-clamp-4">
            {post.caption || <span className="text-text-muted italic">No caption yet</span>}
          </p>
          <div className="flex gap-2 mt-3">
            <button onClick={onEdit} className="text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors">✎ Edit</button>
            <button onClick={onDelete} disabled={busy} className="text-xs text-error border border-error/30 rounded-lg px-3 py-1.5 hover:bg-error/5 transition-colors disabled:opacity-50">🗑 Delete</button>
          </div>
        </>
      )}
    </div>
  );
}
