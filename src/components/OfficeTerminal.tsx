import { Container, Graphics, Text, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useRef } from 'react';

export default function OfficeTerminal({ onOpen }: { onOpen: () => void }) {
  const glow = useRef<PIXI.Graphics>(null);
  const elapsed = useRef(0);
  useTick((delta) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    elapsed.current += delta;
    if (glow.current) glow.current.alpha = 0.35 + 0.3 * Math.sin(elapsed.current / 30);
  });
  return (
    <Container
      x={240}
      y={34}
      eventMode="static"
      cursor="pointer"
      pointertap={(event: PIXI.FederatedPointerEvent) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      <Graphics
        draw={(g) => {
          g.clear()
            .beginFill(0x050e16)
            .lineStyle(2, 0x64828a)
            .drawRoundedRect(0, 0, 288, 58, 4)
            .endFill();
          g.lineStyle(1, 0x17403c);
          for (let x = 12; x < 280; x += 16) g.moveTo(x, 25).lineTo(x, 49);
          g.lineStyle(2, 0x43d9a3).moveTo(12, 46);
          [40, 34, 41, 30, 32, 22, 28, 18, 24, 14, 20, 10].forEach((y, i) =>
            g.lineTo(15 + i * 23, 28 + y / 2),
          );
        }}
      />
      <Graphics
        ref={glow}
        draw={(g) => {
          g.clear().beginFill(0x43d9a3).drawRect(8, 51, 272, 2).endFill();
        }}
      />
      <Text
        text="ATO MARKET TERMINAL  /  CLICK TO OPEN"
        x={12}
        y={7}
        style={new PIXI.TextStyle({ fontFamily: 'monospace', fontSize: 10, fill: 0xffba58 })}
      />
    </Container>
  );
}
