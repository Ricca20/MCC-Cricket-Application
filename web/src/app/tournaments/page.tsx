"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Trophy, Calendar, Users } from 'lucide-react';
import api, { errorMessage } from '@/lib/api';
import type { Tournament } from '@/lib/types';

export default function TournamentsList() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const res = await api.get('/tournaments');
        setTournaments(res.data);
      } catch (err) {
        setError(errorMessage(err, 'Failed to load tournaments'));
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, []);

  return (
    <div className="min-h-screen p-4 sm:p-6 pb-20">
      <header className="glass-panel sticky top-0 z-50 rounded-none border-t-0 border-l-0 border-r-0 border-b border-white/10 px-4 py-4 flex flex-col gap-3 max-w-4xl mx-auto mb-6">
        <div className="flex items-center justify-between w-full">
          <Link href="/" className="flex items-center text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6 mr-1" />
            <span className="font-medium text-sm">Dashboard</span>
          </Link>
          <div className="font-bold text-lg tracking-wide flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" /> Tournaments
          </div>
          <div className="w-[88px]"></div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white mb-2">Live & Upcoming</h1>
          <p className="text-slate-400">Follow the action across all club tournaments.</p>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center">
            {error}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="glass-panel p-12 text-center flex flex-col items-center">
            <Trophy className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Tournaments Found</h3>
            <p className="text-slate-400">There are no active tournaments at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tournaments.map((t) => (
              <Link key={t._id} href={`/tournaments/${t.publicSlug}`} className="glass-panel p-6 hover:bg-white/10 transition-all hover:-translate-y-1 group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg text-white">{t.name}</h2>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                        {t.status.replace('-', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">{new Date(t.startDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">{t.teams?.length || 0} Teams</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
