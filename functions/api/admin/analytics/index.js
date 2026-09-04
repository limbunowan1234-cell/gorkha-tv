import { json } from '../../../../shared/http.js';
import { todayKey } from '../../../../shared/db.js';

// Gated by functions/api/admin/_middleware.js, no changes needed there.
// "Active sessions" is treated as the same number as DAU — there's no cheap
// way to track literal real-time presence with a day-bucketed table without
// a raw heartbeat/event log, which this codebase deliberately avoids
// elsewhere (see shared/schema.sql's day-bucketed-counter convention).

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;
  const today = todayKey();
  const monthAgo = daysAgo(29);
  const weekAgo = daysAgo(6);

  const yesterday = daysAgo(1);

  const [dauRow, dauYesterdayRow, mauRow, newTodayRow, trend, watchToday, watchYesterday, watch7d, watch30d] = await Promise.all([
    db.prepare(`SELECT COUNT(DISTINCT session_key) AS c FROM session_activity_daily WHERE activity_date = ?`).bind(today).first(),
    // Yesterday's DAU, purely so the frontend can show a "vs yesterday"
    // delta pill on the headline number — the single most common thing a
    // "professional" analytics dashboard shows next to its top-line metric.
    db.prepare(`SELECT COUNT(DISTINCT session_key) AS c FROM session_activity_daily WHERE activity_date = ?`).bind(yesterday).first(),
    db.prepare(`SELECT COUNT(DISTINCT session_key) AS c FROM session_activity_daily WHERE activity_date >= ?`).bind(monthAgo).first(),
    db.prepare(`SELECT COUNT(*) AS c FROM session_first_seen WHERE first_seen_date = ?`).bind(today).first(),
    db
      .prepare(`SELECT activity_date, COUNT(DISTINCT session_key) AS c FROM session_activity_daily WHERE activity_date >= ? GROUP BY activity_date ORDER BY activity_date`)
      .bind(monthAgo)
      .all(),
    db.prepare(`SELECT COALESCE(SUM(seconds_watched),0) AS s FROM watch_time_daily WHERE watch_date = ?`).bind(today).first(),
    db.prepare(`SELECT COALESCE(SUM(seconds_watched),0) AS s FROM watch_time_daily WHERE watch_date = ?`).bind(yesterday).first(),
    db.prepare(`SELECT COALESCE(SUM(seconds_watched),0) AS s FROM watch_time_daily WHERE watch_date >= ?`).bind(weekAgo).first(),
    db.prepare(`SELECT COALESCE(SUM(seconds_watched),0) AS s FROM watch_time_daily WHERE watch_date >= ?`).bind(monthAgo).first(),
  ]);

  const dau = dauRow.c;
  const newToday = newTodayRow.c;

  // Business-facing, admin-only — never cached.
  return json(
    {
      dau,
      dauYesterday: dauYesterdayRow.c,
      mau: mauRow.c,
      newToday,
      returningToday: Math.max(0, dau - newToday),
      watchTimeSeconds: { today: watchToday.s, yesterday: watchYesterday.s, last7d: watch7d.s, last30d: watch30d.s },
      dauTrend: trend.results,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
