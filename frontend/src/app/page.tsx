"use client";

import Link from "next/link";

const STEPS = [
  { n: "01", title: "Deploy an agent", desc: "Give it a mission and fund its wallet via PayPal. The agent runs autonomously from here.", color: "blue" },
  { n: "02", title: "Agent decomposes", desc: "Claude validates the mission requires ground truth, then breaks it into targeted tasks.", color: "violet" },
  { n: "03", title: "Humans observe", desc: "Couriers, drivers, residents — people on the ground submit what they see and get paid.", color: "emerald" },
  { n: "04", title: "Agent learns", desc: "The agent validates submissions, fuses sources, and discovers patterns no single person can see.", color: "violet" },
  { n: "05", title: "Agent pays out", desc: "Value attribution calculates each contributor's share. PayPal distributes instantly.", color: "emerald" },
];

const PERSONAS = [
  {
    icon: "🛵",
    name: "Alex Chen",
    role: "Delivery Courier",
    location: "East London",
    bio: "7 years on the road. Knows every back alley between Shoreditch and Bethnal Green.",
    earning: "$25",
    task: "demo-task-courier-001",
    accent: "emerald",
  },
  {
    icon: "🚕",
    name: "Sam Rodriguez",
    role: "Rideshare Driver",
    location: "Central & East London",
    bio: "Full-time Uber driver. Tracks pattern shifts across the city in real time.",
    earning: "$20",
    task: "demo-task-driver-001",
    accent: "blue",
  },
  {
    icon: "🏠",
    name: "Jordan Patel",
    role: "Local Resident",
    location: "Shoreditch / Hoxton",
    bio: "Lived in Shoreditch for 12 years. Watched 40+ restaurants open on Redchurch St.",
    earning: "$15",
    task: "demo-task-resident-001",
    accent: "violet",
  },
];

const TASKS = [
  { id: "demo-task-courier-001", icon: "🛵", title: "Delivery Bottleneck Survey", role: "delivery courier", location: "East London", reward: 25 },
  { id: "demo-task-driver-001", icon: "🚕", title: "Evening Traffic Pattern Report", role: "rideshare driver", location: "Central / East London", reward: 20 },
  { id: "demo-task-resident-001", icon: "🏠", title: "Neighbourhood Change Observation", role: "local resident", location: "Shoreditch / Hoxton", reward: 15 },
];

const accentMap: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  violet: "bg-violet-50 text-violet-700 border-violet-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

export default function Home() {
  return (
    <div className="w-full">

      {/* ── Hero ── */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-500 mb-8">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          PayPal AI Hackathon 2026 · Live Demo
        </div>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-gray-900 mb-5 leading-tight">
          AI agents that hire<br />real people to learn
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed">
          Deploy an autonomous AI agent with a mission and a PayPal wallet.
          It recruits human observers, validates what they find, and pays them —
          all without you lifting a finger.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/agents/new" className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
            Deploy an agent
          </Link>
          <Link href="/earn" className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:border-gray-400 transition-colors">
            Earn as contributor →
          </Link>
        </div>
      </section>

      <div className="border-t border-gray-100" />

      {/* ── The gap ── */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-5">
          <div className="border border-gray-200 rounded-xl p-6">
            <span className="inline-block text-xs font-semibold text-red-500 uppercase tracking-wide mb-4">AI alone can't answer this</span>
            <p className="text-gray-800 text-lg leading-relaxed mb-4">
              "Which London streets have the worst delivery delays on Friday evenings, and what's causing them right now?"
            </p>
            <p className="text-sm text-gray-400">
              No training data. No public dataset. The answer only lives in the lived experience of people on the ground.
            </p>
          </div>
          <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-6">
            <span className="inline-block text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-4">An UNMADE agent answers this</span>
            <p className="text-sm text-gray-700 leading-relaxed mb-5">
              The agent recruits a courier, a driver, and a resident. Each submits an independent observation.
              The agent discovers a compound pattern — a street market + construction diversion coinciding on Fridays —
              that no single person could see alone.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs border border-violet-200 bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-medium">Novel finding</span>
              <span className="text-xs border border-emerald-200 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Cross-validated</span>
              <span className="text-xs border border-blue-200 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">87% confidence</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-gray-100 bg-gray-50/60">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">How it works</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-10">Five stages of autonomous intelligence gathering</h2>
          <div className="grid md:grid-cols-5 gap-4">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                <div className="bg-white border border-gray-100 rounded-xl p-4 h-full shadow-sm">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-3 ${accentMap[s.color]}`}>
                    {s.n}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-1.5 leading-tight">{s.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:flex absolute -right-2.5 top-5 w-5 h-5 items-center justify-center text-gray-300 text-xs z-10">→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agent wallet model ── */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Agent economics</p>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Fund it once. The agent manages the rest.</h2>
        <p className="text-sm text-gray-500 mb-10 max-w-xl">
          The agent draws from its PayPal wallet to pay contributors based on marginal contribution —
          how much the intelligence would degrade without each person's data.
        </p>
        <div className="border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-center px-5 py-3 bg-gray-900 rounded-lg">
              <p className="text-2xl font-black text-white">$100</p>
              <p className="text-xs text-gray-300 mt-0.5">Agent wallet</p>
            </div>
            <div className="text-gray-300 text-xl">→</div>
            <div className="text-center px-5 py-3 bg-gray-50 rounded-lg">
              <p className="text-xl font-bold text-gray-400">$20</p>
              <p className="text-xs text-gray-500 mt-0.5">Platform (20%)</p>
            </div>
            <div className="text-gray-300 text-xl">→</div>
            <div className="flex gap-3">
              {[
                { icon: "🛵", name: "Alex", amt: "$38.40", pct: "48%" },
                { icon: "🚕", name: "Sam", amt: "$28.80", pct: "36%" },
                { icon: "🏠", name: "Jordan", amt: "$12.80", pct: "16%" },
              ].map((c) => (
                <div key={c.name} className="text-center border border-gray-100 rounded-lg px-4 py-3">
                  <div className="text-xl mb-1">{c.icon}</div>
                  <p className="text-xs text-gray-500">{c.name}</p>
                  <p className="font-bold text-emerald-600 text-sm">{c.amt}</p>
                  <p className="text-xs text-gray-400">{c.pct}</p>
                </div>
              ))}
            </div>
            <div className="text-center px-4 py-3">
              <p className="text-sm font-bold text-blue-600">PayPal</p>
              <p className="text-xs text-gray-400">Payouts API</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contributors ── */}
      <section className="border-t border-gray-100 bg-gray-50/60">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Contributors</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-10">The people who know what AI doesn't</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {PERSONAS.map((p) => (
              <div key={p.name} className="border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors bg-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-xl">{p.icon}</div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.role} · {p.location}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-5">{p.bio}</p>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${accentMap[p.accent]}`}>
                    {p.earning} / observation
                  </span>
                  <Link href={`/earn/task/${p.task}`} className="text-xs text-gray-400 hover:text-gray-900 transition-colors">
                    View task →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live tasks ── */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Open right now</p>
            <h2 className="text-2xl font-bold text-gray-900">Submit an observation, get paid</h2>
          </div>
          <Link href="/earn" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">View all →</Link>
        </div>
        <div className="space-y-3">
          {TASKS.map((task) => (
            <Link
              key={task.id}
              href={`/earn/task/${task.id}`}
              className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-gray-400 hover:shadow-sm transition-all group"
            >
              <span className="text-2xl">{task.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 mb-1">{task.title}</p>
                <div className="flex gap-2">
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{task.role}</span>
                  <span className="text-xs text-gray-400">📍 {task.location}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-emerald-600">${task.reward}</p>
                <p className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">submit →</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-16 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-bold text-gray-900 mb-1">Ready to try it?</p>
            <p className="text-sm text-gray-500">Deploy an agent with a mission — or submit an observation and earn.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link href="/agents/new" className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
              Deploy an agent
            </Link>
            <Link href="/earn" className="px-5 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:border-gray-400 transition-colors">
              View open tasks
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
