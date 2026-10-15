import { useRef, useState } from 'react';
import PixiGame from './PixiGame.tsx';

import { useElementSize } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import { Doc } from '../../convex/_generated/dataModel';
import { api } from '../../convex/_generated/api';
import { useWorldHeartbeat } from '../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../hooks/useHistoricalTime.ts';
import { DebugTimeManager } from './DebugTimeManager.tsx';
import { GameId } from '../../convex/aiTown/ids.ts';
import MarketTerminal from './MarketTerminal';
import { useServerGame } from '../hooks/serverGame.ts';

export const SHOW_DEBUG_UI = !!import.meta.env.VITE_SHOW_DEBUG_UI;

export default function Game({
  ownerToken,
  officeProfiles,
}: {
  ownerToken: string;
  officeProfiles: Doc<'employeeProfiles'>[];
}) {
  const convex = useConvex();
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalClock, setTerminalClock] = useState(Date.now());
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>;
  }>();
  const [gameWrapperRef, { width, height }] = useElementSize();

  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const engineId = worldStatus?.engineId;

  const game = useServerGame(worldId);

  // Send a periodic heartbeat to our world to keep it alive.
  useWorldHeartbeat();

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  const scrollViewRef = useRef<HTMLDivElement>(null);
  const selectedProfile = officeProfiles.find((p) => p.playerId === selectedElement?.id);

  if (!worldId || !engineId || !game) {
    return null;
  }
  return (
    <>
      {SHOW_DEBUG_UI && <DebugTimeManager timeManager={timeManager} width={200} height={100} />}
      <div className="office-frame">
        {/* Game area */}
        <div className="office-canvas" ref={gameWrapperRef}>
          <div className="office-canvas-caption">TRADING FLOOR · DRAG TO PAN / SCROLL TO ZOOM</div>
          <button
            className="terminal-shortcut"
            onClick={() => {
              setTerminalClock(Date.now());
              setTerminalOpen(true);
            }}
          >
            Open market terminal
          </button>
          <div className="absolute inset-0">
            <div className="container">
              <Stage width={width} height={height} options={{ backgroundColor: 0x101e28 }}>
                {/* Re-propagate context because contexts are not shared between renderers.
https://github.com/michalochman/react-pixi-fiber/issues/145#issuecomment-531549215 */}
                <ConvexProvider client={convex}>
                  <PixiGame
                    game={game}
                    worldId={worldId}
                    engineId={engineId}
                    width={width}
                    height={height}
                    historicalTime={historicalTime}
                    setSelectedElement={setSelectedElement}
                    ownerToken={ownerToken}
                    onOpenTerminal={() => {
                      setTerminalClock(Date.now());
                      setTerminalOpen(true);
                    }}
                    selectedEmployeeId={selectedProfile?.employeeId}
                  />
                </ConvexProvider>
              </Stage>
            </div>
          </div>
        </div>
        {/* Right column area */}
        <div className="office-inspector" ref={scrollViewRef}>
          <span className="employee-tag">THE TEAM</span>
          <h2>Five perspectives.</h2>
          <p>Select an employee to inspect their profile.</p>
          <div className="employee-roster">
            {officeProfiles.map((p) => (
              <button
                key={p._id}
                className={p.playerId === selectedElement?.id ? 'selected' : ''}
                onClick={() =>
                  setSelectedElement({ kind: 'player', id: p.playerId as GameId<'players'> })
                }
              >
                <span className="employee-dot">{p.name[0]}</span>
                <span>
                  {p.name}
                  <small>{p.specialty}</small>
                </span>
              </button>
            ))}
          </div>
          {selectedProfile && (
            <dl className="employee-facts">
              <dt>STRATEGY PREFERENCE</dt>
              <dd>{selectedProfile.strategy}</dd>
              <dt>MARKET ACCESS</dt>
              <dd>All verified, selected instruments</dd>
              <dt>MODEL CANDIDATE</dt>
              <dd>{selectedProfile.modelCandidate}</dd>
              <dt>STATUS</dt>
              <dd>Inactive · Profile v{selectedProfile.profileVersion}</dd>
              <dt>DESK</dt>
              <dd>
                {selectedProfile.deskX}, {selectedProfile.deskY}
              </dd>
            </dl>
          )}
          <div className="phase-lock">AI inference and trading are disabled.</div>
          {ownerToken && selectedProfile && (
            <p>
              Click an empty floor tile to move {selectedProfile.name}. Movement is an audited CEO
              action.
            </p>
          )}
        </div>
      </div>
      {terminalOpen && (
        <MarketTerminal
          clock={terminalClock}
          ownerToken={ownerToken}
          onClose={() => setTerminalOpen(false)}
        />
      )}
    </>
  );
}
