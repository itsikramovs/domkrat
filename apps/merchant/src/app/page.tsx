type HealthStatus = { ok: boolean; payload?: unknown; error?: string };

async function fetchHealth(): Promise<HealthStatus> {
  const url = `${process.env.INTERNAL_API_URL ?? 'http://localhost:3001/api/v1'}/health/db`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const payload: unknown = await res.json().catch(() => ({}));
    return { ok: res.ok, payload };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default async function HomePage() {
  const health = await fetchHealth();
  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Domkrat · merchant</h1>
      <p className="text-gray-600 mb-6">Merchant cabinet (port 3002)</p>

      <section className="border rounded-lg p-4">
        <h2 className="font-semibold mb-2">API status</h2>
        <p>
          <span className="font-mono">/api/v1/health/db</span> →{' '}
          <span className={health.ok ? 'text-green-600' : 'text-red-600'}>
            {health.ok ? 'ok' : 'error'}
          </span>
        </p>
        {health.error ? (
          <pre className="mt-2 text-xs text-red-700 overflow-auto">{health.error}</pre>
        ) : (
          <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto">
            {JSON.stringify(health.payload, null, 2)}
          </pre>
        )}
      </section>

      <footer className="mt-8 text-xs text-gray-500">
        MVP bootstrap · полный каталог появится в Sprint 2+ (см. docs/claude-code/CLAUDE-CODE-PLAN.md)
      </footer>
    </main>
  );
}
