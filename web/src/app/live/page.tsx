"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Radio } from 'lucide-react';
import api from '@/lib/api';
import type { Match } from '@/lib/types';

const STATUS_STYLE: Record<Match['status'], string> = {
  live: 'bg-green-500/20 text-green-400 border-green-500/30',
  upcoming: 'bg-slate-800 text-slate-300 border-slate-700',
  completed: 'bg-accent/20 text-accent border-accent/30'
};

export default function LiveMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Match[]>('/matches/public')
      .then((res) => setMatches(res.data))
      .catch(() => setError('Failed to load matches'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen p-4 sm:p-6 pb-20">
      <main className="max-w-3xl mx-auto space-y-6">
        <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white">
          <ChevronLeft className="w-5 h-5 mr-1" /> Dashboard
        </Link>
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3"><Radio className="w-7 h-7 text-green-400" /> Matches</h1>

        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : matches.length === 0 ? (
          <p className="text-slate-400">No matches yet.</p>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <Link key={m._id} href={`/live/${m.publicSlug}`} className="glass-panel p-4 flex items-center justify-between gap-4 hover:bg-white/10 transition-colors">
                <div>
                  <p className="font-bold text-white">{m.teamA.name} vs {m.teamB.name}</p>
                  <p className="text-sm text-slate-400">{new Date(m.date).toLocaleDateString()} · {m.oversLimit} overs{m.result ? ` · ${m.result}` : ''}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${STATUS_STYLE[m.status]}`}>{m.status}</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
