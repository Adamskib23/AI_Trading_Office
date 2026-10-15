import { useEffect, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export default function MarketTerminal({ clock, onClose }: { clock: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [now, setNow] = useState(clock);
  const feeds = useQuery(api.marketData.status, { clock: now });
  useEffect(() => {
    dialog.current?.showModal();
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <dialog
      ref={dialog}
      className="market-terminal"
      onClose={onClose}
      aria-labelledby="terminal-title"
    >
      <header>
        <div>
          <span>ATO / MARKET MONITOR</span>
          <h2 id="terminal-title">Global instruments</h2>
        </div>
        <button autoFocus onClick={() => dialog.current?.close()}>
          Close terminal
        </button>
      </header>
      <p>Read-only provider feed · updates when backend data arrives · all source times UTC.</p>
      <p>
        Prices may be stale, delayed or unverified. Opening this screen does not poll providers.
      </p>
      <div className="terminal-table" tabIndex={0} role="region" aria-label="Market instruments">
        <table>
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Last</th>
              <th>Currency</th>
              <th>Source time (UTC)</th>
              <th>Freshness</th>
              <th>Source / mode</th>
              <th>Feed result</th>
            </tr>
          </thead>
          <tbody>
            {feeds?.rows.map((row) => {
              const quote = row.quote;
              const age = quote ? now - quote.sourceTimestamp : undefined;
              const freshness =
                age === undefined
                  ? 'NO DATA'
                  : age < 0
                    ? 'CLOCK ERROR'
                    : age > 120_000
                      ? 'STALE'
                      : 'RECENT';
              return (
                <tr key={row.instrumentId}>
                  <th scope="row">{row.symbol}</th>
                  <td className="terminal-price">{quote?.last ?? '—'}</td>
                  <td>{quote?.currency ?? '—'}</td>
                  <td>
                    {quote
                      ? new Date(quote.sourceTimestamp)
                          .toISOString()
                          .replace('T', ' ')
                          .replace('.000Z', '')
                      : '—'}
                  </td>
                  <td data-fresh={freshness === 'RECENT'}>{freshness}</td>
                  <td>
                    {row.provider} / {quote?.sourceMode ?? 'unverified'}
                  </td>
                  <td>
                    {row.event?.message ?? (row.configured ? 'Not fetched' : 'Credential required')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!feeds && <p role="status">Connecting to feed store…</p>}
      </div>
      <footer>
        RECENT describes age only. Execution also requires rights, session and risk checks. No
        trades from this terminal.
      </footer>
    </dialog>
  );
}
