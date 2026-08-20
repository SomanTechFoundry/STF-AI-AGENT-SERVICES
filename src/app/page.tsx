export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          STF AI Agent Services
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Multi-tenant AI Agent Services Platform for local businesses.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-left">
          <div className="rounded-lg border p-4">
            <h2 className="font-semibold mb-2">Platform Status</h2>
            <p className="text-sm text-gray-500">Foundation — Phase 1</p>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="font-semibold mb-2">API</h2>
            <p className="text-sm text-gray-500">
              <a href="/api/health" className="text-blue-600 hover:underline">
                /api/health
              </a>
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="font-semibold mb-2">Target Vertical</h2>
            <p className="text-sm text-gray-500">Salons / Barbers</p>
          </div>
        </div>
      </div>
    </main>
  );
}
