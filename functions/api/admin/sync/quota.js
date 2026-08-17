import { json } from '../../../../shared/http.js';
import { getTodayQuotaUsage } from '../../../../shared/db.js';
import { QUOTA } from '../../../../shared/constants.js';

export async function onRequestGet(context) {
  const { env } = context;
  const usage = await getTodayQuotaUsage(env.DB);
  return json({
    date: usage.date,
    unitsUsed: usage.units_used,
    searchCallsUsed: usage.search_calls_used,
    dailySoftCap: env.SYNC_DAILY_QUOTA_SOFT_CAP ? Number(env.SYNC_DAILY_QUOTA_SOFT_CAP) : QUOTA.dailySoftCapUnits,
    maxSearchCallsPerDay: QUOTA.maxSearchCallsPerDay,
  });
}
