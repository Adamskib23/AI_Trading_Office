import type { DatabaseReader } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
// Legacy endpoints stay usable for archived upstream worlds, but cannot mutate an office.
export async function denyOfficeWorld(db: DatabaseReader, worldId: Id<'worlds'>) {
  const office = await db
    .query('officeSetup')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .first();
  if (office) throw new Error('Use authenticated office controls');
}
