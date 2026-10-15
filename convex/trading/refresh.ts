import type { DatabaseReader, MutationCtx } from '../_generated/server';
import { internal } from '../_generated/api';

export const ORDER_REFRESH_DELAY = 65_000;

export function canRefreshOrder(
  order: { expiresAt: number },
  run: { mode: string; status: string; stopAt?: number } | null,
  at: number,
) {
  return (
    order.expiresAt > at &&
    run?.mode === 'PROVIDER' &&
    run.status === 'ACTIVE' &&
    (!run.stopAt || run.stopAt > at)
  );
}

export async function pendingRefreshNeeded(db: DatabaseReader, instrumentId: string, at: number) {
  const orders = await db
    .query('paperOrders')
    .withIndex('instrumentStatus', (q) =>
      q.eq('instrumentId', instrumentId).eq('status', 'ACCEPTED'),
    )
    .take(100);
  for (const order of orders) {
    if (order.expiresAt <= at) continue;
    const run = await db.get(order.runId);
    if (canRefreshOrder(order, run, at)) return true;
  }
  return false;
}

export async function claimQueuedRefresh(
  ctx: MutationCtx,
  instrumentId: string,
  generation: number,
  now: number,
) {
  const job = await ctx.db
    .query('marketRefreshJobs')
    .withIndex('instrument', (q) => q.eq('instrumentId', instrumentId))
    .unique();
  if (!job || job.generation !== generation || !job.dueAt || job.dueAt > now) return false;
  await ctx.db.patch(job._id, { dueAt: 0 });
  return pendingRefreshNeeded(ctx.db, instrumentId, now);
}

// Share one durable refresh per instrument across employees and TEST runs.
export async function scheduleOrderRefresh(ctx: MutationCtx, instrumentId: string, at: number) {
  const record = await ctx.db
    .query('marketRefreshJobs')
    .withIndex('instrument', (q) => q.eq('instrumentId', instrumentId))
    .unique();
  if (record && record.dueAt > Date.now() && record.dueAt <= at) return;
  const generation = (record?.generation ?? 0) + 1;
  const value = { instrumentId, dueAt: at, generation };
  if (record) await ctx.db.patch(record._id, value);
  else await ctx.db.insert('marketRefreshJobs', value);
  await ctx.scheduler.runAt(at, internal.marketData.pollQueued, { instrumentId, generation });
}
