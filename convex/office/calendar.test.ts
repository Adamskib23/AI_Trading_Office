import { marketState } from './calendar';
import { assertOwner } from './access';
import { INSTRUMENTS } from './registry';
import { EMPLOYEES, officeMap } from '../../data/office';
import { getLLMConfig } from '../util/llm';
const us = (iso: string) => marketState('us-equity', Date.parse(iso)).state;
test('Phase 1 rejects model configuration before any external request', () => {
  const previous = process.env.OFFICE_PHASE;
  process.env.OFFICE_PHASE = '1';
  try {
    expect(() => getLLMConfig()).toThrow('disabled during Phase 1');
  } finally {
    if (previous === undefined) delete process.env.OFFICE_PHASE;
    else process.env.OFFICE_PHASE = previous;
  }
});
describe('US core session boundaries', () => {
  test('opens at 09:30 NY in both EST and EDT', () => {
    expect(us('2026-03-06T14:29:59Z')).toBe('CLOSED');
    expect(us('2026-03-06T14:30:00Z')).toBe('OPEN');
    expect(us('2026-03-09T13:29:59Z')).toBe('CLOSED');
    expect(us('2026-03-09T13:30:00Z')).toBe('OPEN');
    expect(us('2026-11-02T14:30:00Z')).toBe('OPEN');
  });
  test('closes at 16:00 and excludes weekends and holidays', () => {
    expect(us('2026-10-15T19:59:59Z')).toBe('OPEN');
    expect(us('2026-10-15T20:00:00Z')).toBe('CLOSED');
    expect(us('2026-10-17T15:00:00Z')).toBe('CLOSED');
    expect(us('2026-07-03T15:00:00Z')).toBe('CLOSED');
    expect(us('2026-04-03T15:00:00Z')).toBe('CLOSED');
    expect(us('2026-11-26T15:00:00Z')).toBe('CLOSED');
  });
  test('early close and unsupported year fail closed', () => {
    expect(us('2026-11-27T17:59:59Z')).toBe('OPEN');
    expect(us('2026-11-27T18:00:00Z')).toBe('CLOSED');
    expect(us('2026-12-24T18:00:00Z')).toBe('CLOSED');
    expect(us('2028-01-03T15:00:00Z')).toBe('UNVERIFIED');
  });
  test('FX session cannot claim provider readiness; crypto remains a reference session', () => {
    expect(marketState('fx-reference', Date.parse('2026-10-17T12:00:00Z')).state).toBe('CLOSED');
    expect(marketState('fx-reference', Date.parse('2026-10-18T20:59:00Z')).state).toBe('CLOSED');
    expect(marketState('fx-reference', Date.parse('2026-10-18T21:00:00Z')).state).toBe(
      'UNVERIFIED',
    );
    expect(marketState('crypto', Date.parse('2026-10-17T12:00:00Z')).state).toBe('OPEN');
  });
});
test('owner controls reject missing and incorrect credentials', () => {
  const token = 'a'.repeat(64);
  expect(() => assertOwner('', token)).toThrow('denied');
  expect(() => assertOwner(token + 'x', token)).toThrow('denied');
  expect(() => assertOwner('b'.repeat(64), token)).toThrow('denied');
  expect(() => assertOwner(token, token)).not.toThrow();
  expect(() => assertOwner('short', 'short')).toThrow('not configured');
});
test('all five desks have reachable seats and all required classes exist', () => {
  const map = officeMap();
  expect(EMPLOYEES).toHaveLength(5);
  const reachable = new Set<string>();
  const queue = [[1, 1]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    const key = `${x},${y}`;
    if (
      reachable.has(key) ||
      x < 0 ||
      y < 0 ||
      x >= map.width ||
      y >= map.height ||
      map.objectTiles.some((l) => l[x][y] !== -1)
    )
      continue;
    reachable.add(key);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  for (const { desk } of EMPLOYEES) {
    expect(reachable.has(`${desk.x},${desk.y + 1}`)).toBe(true);
    expect(map.objectTiles[0][desk.x][desk.y]).not.toBe(-1);
  }
  expect(new Set(INSTRUMENTS.map((i) => i.id)).size).toBe(14);
  expect(new Set(INSTRUMENTS.map((i) => i.assetClass))).toEqual(
    new Set(['stock', 'etf', 'fx', 'crypto']),
  );
  expect(INSTRUMENTS.filter((i) => i.exposure === 'commodity_proxy')).toHaveLength(3);
});
