// Diagnostic only: no credentials, system changes, retries or timestamp repairs.
try {
  const started = Date.now();
  const response = await fetch('https://api.kraken.com/0/public/Time', {
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('CLOCK_PROBE_UNAVAILABLE');
  const data = await response.json();
  const received = Date.now();
  const providerMs = Number(data.result?.unixtime) * 1000;
  if (!Number.isFinite(providerMs) || data.error?.length) throw new Error('CLOCK_PROBE_INVALID');
  const skewMs = providerMs - (started + received) / 2;
  console.log(
    JSON.stringify({
      localUtc: new Date(received).toISOString(),
      providerUtc: new Date(providerMs).toISOString(),
      httpDate: response.headers.get('date'),
      skewSeconds: Math.round(skewMs) / 1000,
      synchronized: Math.abs(skewMs) <= 5000,
    }),
  );
  if (Math.abs(skewMs) > 5000) {
    console.log(
      'Clock check failed. Verify Windows automatic time and synchronization; compare another trusted clock. Do not subtract an offset from market timestamps.',
    );
    process.exitCode = 2;
  }
} catch {
  console.log('Public clock check unavailable. No system settings or feed permissions changed.');
  process.exitCode = 1;
}
