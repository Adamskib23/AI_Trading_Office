import type { SerializedWorldMap } from '../convex/aiTown/worldMap';

export const EMPLOYEES = [
  {
    id: 'alex',
    name: 'Alex',
    character: 'f1',
    specialty: 'Equities / earnings',
    strategy: 'Trend-following',
    desk: { x: 5, y: 5 },
  },
  {
    id: 'sophie',
    name: 'Sophie',
    character: 'f2',
    specialty: 'FX / macroeconomics',
    strategy: 'Mean-reversion',
    desk: { x: 11, y: 5 },
  },
  {
    id: 'marcus',
    name: 'Marcus',
    character: 'f4',
    specialty: 'Crypto / sentiment',
    strategy: 'Momentum',
    desk: { x: 17, y: 5 },
  },
  {
    id: 'nina',
    name: 'Nina',
    character: 'f3',
    specialty: 'Commodity / sector ETFs',
    strategy: 'Breakouts',
    desk: { x: 7, y: 11 },
  },
  {
    id: 'oliver',
    name: 'Oliver',
    character: 'f7',
    specialty: 'Macro asset allocation',
    strategy: 'Defensive / diversified',
    desk: { x: 15, y: 11 },
  },
] as const;

export function officeMap(): SerializedWorldMap {
  const width = 24,
    height = 18;
  const layer = (value: number) =>
    Array.from({ length: width }, () => Array<number>(height).fill(value));
  const floor = layer(0),
    objects = layer(-1);
  for (let x = 0; x < width; x++)
    for (let y = 0; y < height; y++) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) objects[x][y] = 1;
    }
  for (const { desk } of EMPLOYEES) {
    for (let dx = -1; dx <= 1; dx++) objects[desk.x + dx][desk.y] = dx === 0 ? 3 : 2;
    floor[desk.x][desk.y + 1] = 7;
  }
  // CEO station, meeting table and plants. Object tiles are also collision geometry.
  for (let x = 19; x <= 21; x++) objects[x][14] = x === 20 ? 3 : 2;
  for (let x = 3; x <= 6; x++) for (let y = 14; y <= 15; y++) objects[x][y] = 6;
  for (const [x, y] of [
    [2, 2],
    [21, 2],
    [2, 11],
    [21, 10],
  ])
    objects[x][y] = 5;
  return {
    width,
    height,
    tileDim: 32,
    tileSetUrl: '/ai-town/assets/office-tiles.svg',
    tileSetDimX: 256,
    tileSetDimY: 32,
    bgTiles: [floor],
    objectTiles: [objects],
    animatedSprites: [],
  };
}
