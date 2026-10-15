import { useAction, useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { api } from '../../convex/_generated/api';

export default function PaperLab({ ownerToken, clock }: { ownerToken: string; clock: number }) {
  const feeds = useQuery(api.marketData.status, { clock });
  const data = useQuery(api.paper.dashboard, { clock });
  const fixtures = useMutation(api.paperFixtures.runScenario),
    create = useMutation(api.paper.createRun),
    pause = useMutation(api.paper.setPaused);
  const refresh = useAction(api.marketData.refresh);
  const pauseAll = useMutation(api.paper.pauseAll);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setMessage('');
    try {
      const result = await work();
      setMessage(
        result && typeof result === 'object' && 'status' in result
          ? String(result.status)
          : 'Test action completed.',
      );
    } catch {
      setMessage('Action could not complete. Check access, provider status and limits.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="paper-lab">
      <section className="registry-panel">
        <div className="panel-heading">
          <span className="eyebrow">PHASE 2 / DETERMINISTIC PAPER LAB</span>
          <h2>Real accounting. Simulated execution.</h2>
          <p>
            Scripted tests only. No AI trading, broker connection or official experiment. Fixture
            prices are synthetic and are never provider evidence.
          </p>
          <div className="lab-controls">
            <button
              disabled={!ownerToken || busy}
              onClick={() => void run(() => pauseAll({ ownerToken }))}
            >
              Pause all provider tests
            </button>
            <button
              disabled={!ownerToken || busy}
              onClick={() => void run(() => fixtures({ ownerToken }))}
            >
              Run multi-asset fixture test
            </button>
            <button
              disabled={!ownerToken || busy}
              onClick={() =>
                void run(() => create({ ownerToken, label: 'Owner-created provider TEST' }))
              }
            >
              Create provider TEST accounts
            </button>
          </div>
          {message && <p role="status">{message}</p>}
        </div>
      </section>
      <section className="registry-panel">
        <div className="panel-heading">
          <h2>Feed verification</h2>
          <p>
            Successful receipt confirms a response, not execution eligibility. Rights, sessions,
            freshness and corporate actions are separate gates.
          </p>
          {feeds?.rows.some((r) => !r.configured) && (
            <p className="phase-lock">
              Twelve Data account connection is required for stock, ETF and FX checks. Do not paste
              API keys into chat.
            </p>
          )}
        </div>
        <div className="registry-scroll">
          <table>
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Provider / result</th>
                <th>Source timestamp</th>
                <th>Evidence</th>
                <th>Review gates</th>
                <th>Read-only refresh</th>
              </tr>
            </thead>
            <tbody>
              {feeds?.rows.map((row) => (
                <tr key={row.instrumentId}>
                  <td>
                    <strong>{row.symbol}</strong>
                  </td>
                  <td>
                    {row.provider}
                    <small>
                      {row.configured
                        ? (row.event?.message ?? 'Not fetched')
                        : 'Credential required'}
                    </small>
                  </td>
                  <td>
                    {row.quote ? new Date(row.quote.sourceTimestamp).toLocaleString() : '—'}
                    <small>{row.quote?.sourceMode ?? 'No source'}</small>
                  </td>
                  <td>
                    {row.capability?.quoteVerified ? 'Quote received' : 'Quote pending'}
                    <small>
                      {row.capability?.candlesVerified
                        ? 'Closed candles received'
                        : 'Candles pending'}
                    </small>
                  </td>
                  <td>
                    {row.capability?.rightsVerified ? 'Rights reviewed' : 'Rights unverified'}
                    <small>
                      {row.capability?.sessionVerified ? 'Session reviewed' : 'Session unverified'}
                    </small>
                  </td>
                  <td>
                    <button
                      disabled={!ownerToken || busy || !row.configured}
                      onClick={() =>
                        void run(() => refresh({ ownerToken, instrumentId: row.instrumentId }))
                      }
                    >
                      Refresh
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {data?.runs.map((test) => (
        <section className="registry-panel" key={test._id}>
          <div className="panel-heading">
            <span className="eyebrow">
              {test.mode === 'FIXTURE'
                ? 'SYNTHETIC FIXTURE — NOT MARKET PERFORMANCE'
                : 'PROVIDER-DATA TEST — SIMULATED FUNDS'}
            </span>
            <h2>{test.label}</h2>
            <p>
              {test.status} · {test.fills.length} simulated fills ·{' '}
              {new Date(test.createdAt).toLocaleString()}
            </p>
            <p>
              USD cash reference: $1,000.00 · Mixed basket:{' '}
              {test.benchmark?.mark.equityUsd
                ? `$${Number(test.benchmark.mark.equityUsd).toFixed(2)}`
                : 'Unpriced / pending'}
              {test.benchmark &&
                ` · ${test.benchmark.legs.filter((l) => l.filledAt).length}/4 reference sleeves acquired`}
            </p>
            {test.incidents?.map((incident) => (
              <p key={incident._id} role="status" className="phase-lock">
                {incident.agentId}: {incident.code} · account paused ·{' '}
                {new Date(incident.at).toLocaleString()}
              </p>
            ))}
            {test.stopAt && (
              <p>Bounded day check stops: {new Date(test.stopAt).toLocaleString()}</p>
            )}
            {test.checks?.map((check) => (
              <p key={check._id} role="status">
                {check.kind}: {check.passed ? 'PASS' : 'FAILED — review required'} ·{' '}
                {new Date(check.at).toLocaleString()}
              </p>
            ))}
            {test.mode === 'PROVIDER' && (
              <button
                disabled={!ownerToken || busy || test.status === 'COMPLETED'}
                onClick={() =>
                  void run(() =>
                    pause({ ownerToken, runId: test._id, paused: test.status !== 'PAUSED' }),
                  )
                }
              >
                {test.status === 'PAUSED' ? 'Resume test' : 'Pause trading test'}
              </button>
            )}
          </div>
          <div className="registry-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Cash balances</th>
                  <th>Positions</th>
                  <th>USD equity</th>
                  <th>Ledger</th>
                </tr>
              </thead>
              <tbody>
                {test.portfolios.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <strong>{p.agentId}</strong>
                      <small>{p.filledToday} / 6 daily fills</small>
                    </td>
                    <td>
                      {Object.entries(p.cash)
                        .filter(([, value]) => Number(value) !== 0)
                        .map(([currency, value]) => (
                          <small key={currency}>
                            {currency} {value}
                          </small>
                        ))}
                    </td>
                    <td>
                      {Object.entries(p.positions)
                        .filter(([, value]) => Number(value) !== 0)
                        .map(([asset, value]) => (
                          <small key={asset}>
                            {asset} × {value}
                          </small>
                        ))}
                      {!Object.keys(p.positions).length && '—'}
                    </td>
                    <td>
                      {p.mark.equityUsd === null
                        ? 'Partially unpriced'
                        : `$${Number(p.mark.equityUsd).toFixed(2)}`}
                      <small>
                        {p.mark.components.some((c) => c.status === 'CLOSED_LAST_MARK')
                          ? 'Includes timestamped closed-market marks'
                          : ''}
                      </small>
                    </td>
                    <td className={p.reconciled ? 'reconciled' : 'office-error'}>
                      {p.reconciled ? 'Reconciled' : 'Mismatch — paused'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!!test.orders.length && (
            <div className="registry-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Employee / order</th>
                    <th>Instrument</th>
                    <th>Result</th>
                    <th>Fill source</th>
                  </tr>
                </thead>
                <tbody>
                  {test.orders.map((o) => (
                    <tr key={o._id}>
                      <td>
                        {o.agentId}
                        <small>{o.action}</small>
                      </td>
                      <td>{o.instrumentId}</td>
                      <td>
                        {o.status}
                        <small>{o.reason}</small>
                      </td>
                      <td>
                        <small>{o.fillQuoteId ?? 'No fill'}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
