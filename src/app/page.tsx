import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="max-w-3xl w-full text-center">
        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            Phase 4 Complete — Booking Engine Live
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-3">
            STF AI Agent Services
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Multi-tenant AI receptionist platform for local businesses.
            Book appointments, answer questions, and handle customer interactions — 24/7.
          </p>
        </div>

        {/* Demo CTA */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-1">Live Demo — Sunset Salon</h2>
          <p className="text-sm text-gray-500 mb-4">
            Chat with Sunny, the AI receptionist. Try booking an appointment, asking about services,
            or requesting prices.
          </p>
          <Link
            href="/chat/sunset-salon"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M3.505 2.365A41.369 41.369 0 019 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 00-.577-.069 43.141 43.141 0 00-4.706 0C9.229 4.696 7.5 6.727 7.5 8.998v2.24c0 1.413.67 2.735 1.76 3.562l-2.98 2.98A.75.75 0 015 17.25v-3.443c-.501-.048-1-.106-1.495-.172C2.033 13.438 1 12.162 1 10.72V5.28c0-1.441 1.033-2.717 2.505-2.914z" />
              <path d="M14 6c-.762 0-1.52.02-2.271.062C10.157 6.148 9 7.472 9 8.998v2.24c0 1.519 1.150 2.841 2.71 2.935.214.013.428.024.642.034.2.009.385.09.518.224l2.384 2.386a.75.75 0 001.286-.53v-2.411c.359-.099.695-.233 1.003-.396 1.057-.565 1.457-1.582 1.457-2.643V8.998c0-1.526-1.157-2.85-2.729-2.936A41.645 41.645 0 0014 6z" />
            </svg>
            Open Chat Demo
          </Link>
        </div>

        {/* Status grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
          {[
            { label: "Foundation", phase: "1", done: true },
            { label: "Multi-tenant Core", phase: "2", done: true },
            { label: "AI Agent Core", phase: "3", done: true },
            { label: "Booking Engine", phase: "4", done: true },
          ].map((p) => (
            <div key={p.phase} className="rounded-xl border bg-white px-3 py-3 text-left shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Phase {p.phase}</span>
                {p.done && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-500">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-xs text-gray-700 font-medium">{p.label}</p>
            </div>
          ))}
        </div>

        {/* API links */}
        <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
          <a href="/api/health" className="hover:text-violet-600 transition-colors">Health check</a>
          <span>·</span>
          <a href="/api/chat/sunset-salon" className="hover:text-violet-600 transition-colors">Business API</a>
          <span>·</span>
          <span className="text-gray-300">v0.4.0</span>
        </div>
      </div>
    </main>
  );
}
