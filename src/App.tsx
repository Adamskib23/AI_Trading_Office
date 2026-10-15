import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import Game from './components/Game';
import PaperLab from './components/PaperLab';
import './office.css';

export default function Home() {
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const office = useQuery(api.office.overview, { clock });
  const [tab, setTab] = useState<'office' | 'markets' | 'paper' | 'activity'>('office');
  const [ownerToken, setOwnerToken] = useState('');
  const [credential, setCredential] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const authenticate = useMutation(api.office.authenticate);
  const pause = useMutation(api.office.setPaused);
  const select = useMutation(api.office.selectInstrument);
  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch {
      setError('Action failed. Check owner access and backend status.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="office-shell">
      <header className="office-header">
        <a className="office-brand" href="/ai-town/">
          <span className="brand-mark">◈</span>
          <span>
            AI Trading Office<small>THE AUTONOMOUS OFFICE EXPERIMENT</small>
          </span>
        </a>
        <div className="header-controls">
          <span className="paper-badge">PAPER TRADING · SIMULATED FUNDS</span>
          <button onClick={() => (ownerToken ? setOwnerToken('') : setLoginOpen(!loginOpen))}>
            {ownerToken ? 'Lock controls' : 'CEO access'}
          </button>
        </div>
      </header>
      <section className="office-intro">
        <div>
          <span className="eyebrow">PHASE 2 / PAPER TRADING INFRASTRUCTURE</span>
          <h1>A workspace for five independent minds.</h1>
          <p>
            The team is in place. Test the paper engine with scripted traders. AI activity remains
            disabled.
          </p>
        </div>
        <span className="setup-badge">● SETUP · EXPERIMENT NOT STARTED</span>
      </section>
      {error && (
        <p className="office-error" role="alert">
          {error}
        </p>
      )}
      {loginOpen && !ownerToken && (
        <form
          className="owner-login"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await authenticate({ ownerToken: credential });
              setOwnerToken(credential);
              setCredential('');
              setLoginOpen(false);
            });
          }}
        >
          <label htmlFor="owner-token">Local CEO access token</label>
          <input
            id="owner-token"
            type="password"
            autoComplete="off"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="Paste your local owner token"
          />
          <button disabled={busy || !credential}>Unlock</button>
          <small>
            Generated locally in .office/owner-token.txt. Kept only in this page’s memory.
          </small>
        </form>
      )}
      <section className="office-stats" aria-label="Experiment status">
        <article>
          <span>EMPLOYEES</span>
          <strong>
            {office?.profiles.length ?? '—'}
            <small> / 5</small>
          </strong>
          <p>Independent profiles · shared market access</p>
        </article>
        <article>
          <span>SIMULATED STARTING CAPITAL</span>
          <strong>
            $1,000<small> / employee</small>
          </strong>
          <p>Official funding not started · TEST balances in Paper lab</p>
        </article>
        <article>
          <span>MARKET UNIVERSE</span>
          <strong>
            {office?.instruments.filter((i) => i.selected).length ?? '—'}
            <small> instruments</small>
          </strong>
          <p>All feed entitlements await verification</p>
        </article>
        <article>
          <span>MODEL ACTIVITY</span>
          <strong>Disabled</strong>
          <p>No model calls or research tools enabled</p>
        </article>
      </section>
      <nav className="office-tabs" aria-label="Office sections">
        {(['office', 'markets', 'paper', 'activity'] as const).map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item === 'office'
              ? 'The office'
              : item === 'markets'
                ? 'Market registry'
                : item === 'paper'
                  ? 'Paper lab'
                  : 'Setup activity'}
          </button>
        ))}
        <span>{ownerToken ? 'CEO controls unlocked' : 'Observation mode'}</span>
        {ownerToken && office && (
          <button
            disabled={busy}
            onClick={() => void run(() => pause({ ownerToken, paused: !office.setup.paused }))}
          >
            {office.setup.paused ? 'Resume office' : 'Pause office'}
          </button>
        )}
      </nav>
      {office === undefined ? (
        <div className="office-empty">Connecting to the local office…</div>
      ) : !office ? (
        <div className="office-empty">
          Office setup is not initialised. Run the local Phase 1 setup command.
        </div>
      ) : (
        <>
          {tab === 'office' && <Game ownerToken={ownerToken} officeProfiles={office.profiles} />}
          {tab === 'paper' && <PaperLab ownerToken={ownerToken} clock={clock} />}
          {tab === 'markets' && (
            <section className="registry-panel">
              <div className="panel-heading">
                <h2>A genuinely multi-asset universe</h2>
                <p>
                  Selection does not enable trading. Session labels describe calendar hours, not
                  live quote availability.
                </p>
              </div>
              <div className="registry-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Selected</th>
                      <th>Instrument</th>
                      <th>Exposure</th>
                      <th>Venue</th>
                      <th>Session reference</th>
                      <th>Feed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {office.instruments.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <input
                            aria-label={`Select ${i.symbol}`}
                            type="checkbox"
                            checked={i.selected}
                            disabled={!ownerToken || busy}
                            onChange={(e) =>
                              void run(() =>
                                select({
                                  ownerToken,
                                  instrumentId: i.id,
                                  selected: e.target.checked,
                                }),
                              )
                            }
                          />
                        </td>
                        <td>
                          <strong>{i.symbol}</strong>
                          <small>{i.assetClass === 'fx' ? 'Cash conversion' : i.assetClass}</small>
                        </td>
                        <td>{i.exposure.replaceAll('_', ' ')}</td>
                        <td>{i.venue.replaceAll('_', ' ')}</td>
                        <td>
                          <span className={`session-state ${i.session.state.toLowerCase()}`}>
                            {i.session.state}
                          </span>
                          <small>{i.session.reason}</small>
                        </td>
                        <td>
                          <span className="feed-unverified">
                            {i.entitlement === 'REVIEWED' ? 'Coverage reviewed' : 'Unverified'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="registry-note">
                New York sessions, 2026–2027 calendar. See Paper lab for actual feed health and
                review gates. All employees share the selected universe. Selection alone does not
                enable trading.
              </p>
            </section>
          )}
          {tab === 'activity' && (
            <section className="registry-panel">
              <div className="panel-heading">
                <h2>Setup activity</h2>
                <p>
                  Persisted owner actions. Messages and financial events arrive in later phases.
                </p>
              </div>
              <ul className="audit-list">
                {office.audit.map((event) => (
                  <li key={event._id}>
                    <time>{new Date(event.occurredAt).toLocaleString()}</time>
                    <strong>{event.action.replaceAll('_', ' ')}</strong>
                    <span>
                      {event.employeeId ?? event.instrumentId ?? 'Office'} {event.value ?? ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <footer className="office-footer">
        <span>Built on AI Town · React / PixiJS / Convex</span>
        <span>Phase 2 · No live trading connection · Official run locked</span>
      </footer>
    </main>
  );
}
