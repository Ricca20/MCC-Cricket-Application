"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Trophy, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

export default function TournamentView() {
  const params = useParams();
  const slug = params.slug as string;

  const [tournament, setTournament] = useState<any>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);

  useEffect(() => {
    // Fetch live tournament basics and fixtures
    api.get(`/tournaments/live/${slug}`).then(res => {
      setTournament(res.data.tournament);
      setFixtures(res.data.fixtures);
      
      // Fetch standings
      api.get(`/tournaments/${res.data.tournament._id}/standings`).then(standingsRes => {
         setStandings(standingsRes.data);
      });
    }).catch(err => console.error(err));
  }, [slug]);

  if (!tournament) {
    return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-8">
      <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white mb-6">
        <ChevronLeft className="w-5 h-5 mr-1" /> Back
      </Link>

      <div className="glass-panel p-6 mb-8 text-center bg-gradient-to-br from-primary/10 to-transparent">
        <Trophy className="w-10 h-10 mx-auto text-yellow-400 mb-3" />
        <h1 className="text-3xl font-bold mb-2">{tournament.name}</h1>
        <p className="text-slate-400 uppercase tracking-widest text-sm">{tournament.format}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
        {/* Standings Table */}
        <div className="glass-panel p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            Points Table
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-sm">
                  <th className="pb-3 pr-4 font-medium">Team</th>
                  <th className="pb-3 px-2 font-medium">P</th>
                  <th className="pb-3 px-2 font-medium">W</th>
                  <th className="pb-3 px-2 font-medium">L</th>
                  <th className="pb-3 px-2 font-medium">Pts</th>
                  <th className="pb-3 pl-2 font-medium">NRR</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((team, idx) => (
                  <tr key={team.teamId} className="border-b border-white/5 last:border-0">
                    <td className="py-4 pr-4 font-semibold flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-slate-400">{idx + 1}</span>
                      {team.teamName}
                    </td>
                    <td className="py-4 px-2">{team.played}</td>
                    <td className="py-4 px-2 text-green-400">{team.won}</td>
                    <td className="py-4 px-2 text-red-400">{team.lost}</td>
                    <td className="py-4 px-2 font-bold text-primary">{team.points}</td>
                    <td className="py-4 pl-2 font-mono text-sm">{team.nrr > 0 ? '+' : ''}{team.nrr}</td>
                  </tr>
                ))}
                {standings.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-slate-500">No standings available yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fixtures List */}
        <div className="glass-panel p-6">
          <h2 className="text-xl font-bold mb-4">Fixtures & Results</h2>
          <div className="space-y-3">
            {fixtures.map((fixture) => (
              <div key={fixture._id} className="bg-slate-800/50 p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 flex justify-between items-center px-4">
                  <span className="font-semibold text-right flex-1">{fixture.teamA?.name}</span>
                  <span className="text-slate-500 mx-4 text-sm font-bold">vs</span>
                  <span className="font-semibold text-left flex-1">{fixture.teamB?.name}</span>
                </div>
                {fixture.matchId?.status === 'completed' ? (
                  <div className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full whitespace-nowrap text-center">
                    {fixture.matchId?.result || 'Completed'}
                  </div>
                ) : (
                  <div className="text-xs bg-white/5 text-slate-400 border border-white/10 px-3 py-1 rounded-full whitespace-nowrap text-center">
                    {fixture.round}
                  </div>
                )}
              </div>
            ))}
            {fixtures.length === 0 && (
              <div className="text-center text-slate-500 py-4">No fixtures generated.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
