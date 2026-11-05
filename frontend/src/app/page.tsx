"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
      <h1 className="text-5xl font-bold tracking-tight text-center mb-4">
        UNMADE
      </h1>
      <p className="text-xl text-gray-500 text-center max-w-2xl mb-12">
        The AI-Native Market for Undiscovered Value. Turn overlooked information
        into products people will pay for.
      </p>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full">
        <Link
          href="/earn"
          className="group border border-gray-200 rounded-2xl p-8 hover:border-emerald-500 hover:shadow-lg transition-all"
        >
          <div className="text-3xl mb-4">💡</div>
          <h2 className="text-2xl font-semibold mb-2 group-hover:text-emerald-600">
            Earn
          </h2>
          <p className="text-gray-500 mb-4">Share what you know. Get paid.</p>
          <p className="text-sm text-gray-400">
            Your everyday knowledge could be valuable. See tasks near you,
            submit observations, and earn money when your information helps
            solve real business problems.
          </p>
        </Link>

        <Link
          href="/discover"
          className="group border border-gray-200 rounded-2xl p-8 hover:border-blue-500 hover:shadow-lg transition-all"
        >
          <div className="text-3xl mb-4">🔍</div>
          <h2 className="text-2xl font-semibold mb-2 group-hover:text-blue-600">
            Discover
          </h2>
          <p className="text-gray-500 mb-4">
            Ask a question. Get intelligence.
          </p>
          <p className="text-sm text-gray-400">
            Describe what you need to know. AI decomposes your question,
            recruits real-world observers, fuses their knowledge, and delivers
            an intelligence product no one else can provide.
          </p>
        </Link>
      </div>

      <div className="mt-16 text-center text-sm text-gray-400 max-w-xl">
        <p>
          UNMADE creates value by fusing fragmented knowledge from independent
          sources. The AI discovers hidden relationships between observations
          that no single person can see — and no existing AI can generate from
          public data.
        </p>
      </div>
    </main>
  );
}
