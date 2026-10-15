"use client";

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Trophy, ChevronLeft, Radio } from 'lucide-react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import api, { SOCKET_URL } from '@/lib/api';
import type { Fixture, StandingRow, Tournament } from '@/lib/types';

const FORMAT_LABEL: Record<Tournament['format'], string> = {
  'round-robin': 'Round robin',
  knockout: 'Knockout',
  'groups-knockout': 'Groups then knockout'
};

// Groups rows by a key while keeping first-seen order
const groupBy = <T,>(items: T[], key: (item: T) => string) => {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return [...map.entries()];
};

function FixtureRow({ fixture }: { fixture: Fixture }) {
  const match = fixture.matchId && typeof fixture.matchId === 'object' ? fixture.matchId : null;
  const teamName = (team: Fixture['teamA']) => team?.name || 'TBD';

  const badge = fixture.isBye ? (
    <span className="text-xs bg-white/5 text-slate-400 border border-white/10 px-3 py-1 rounded-full">Bye</span>
  ) : match?.status === 'completed' ? (
    <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full text-center">{match.result || 'Completed'}</span>
  ) : match?.status === 'live' ? (
    <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full inline-flex items-center gap-1"><Radio className="w-3 h-3" /> Live</span>
  ) : (
    <span className="text-xs bg-white/5 text-slate-400 border border-white/10 px-3 py-1 rounded-full">Upcoming</span>
  );

  const body = (
    <>
      <div className="flex-1 flex justify-between items-center px-2">
        <span className={`font-semibold text-right flex-1 ${fixture.winner?._id === fixture.teamA?._id ? 'text-primary' : ''}`}>{teamName(fixture.teamA)}</span>
        <span className="text-slate-500 mx-4 text-sm font-bold">{fixture.isBye ? '' : 'vs'}</span>
        <span className={`font-semibold text-left flex-1 ${fixture.winner?._id === fixture.teamB?._id ? 'text-primary' : ''}`}>{fixture.isBye ? '—' : teamName(fixture.teamB)}</span>
      </div>
      <div className="flex justify-center sm:justify-end">{badge}</div>
    </>
  );

  const className = "bg-slate-800/50 p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3";
  return match?.publicSlug ? (
    <Link href={`/live/${match.publicSlug}`} className={`${className} hover:bg-slate-800`}>{body}</Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default function TournamentView() {
  const params = useParams();
  const slug = params.slug as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(() =>
    api.get<{ tournament: Tournament; fixtures: Fixture[] }>(`/tournaments/live/${slug}`)
      .then(async (res) => {
        setTournament(res.data.tournament);
        setFixtures(res.data.fixtures);
        const standingsRes = await api.get<StandingRow[]>(`/tournaments/${res.data.tournament._id}/standings`);
        setStandings(standingsRes.data);
        return res.data.tournament;
      })
      .catch(() => {
        setError('Tournament not found.');
        return null;
      }), [slug]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { autoConnect: false });
    load().then((loaded) => {
      if (!loaded) return;
      socket.on('connect', () => socket.emit('joinTournament', loaded._id));
      socket.on('tournament:update', () => load());
      socket.connect();
    });
    return () => {
      socket.disconnect();
    };
  }, [load]);

  if (error) {
    return <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center gap-4">{error}<Link href="/tournaments" className="text-primary hover:underline">All tournaments</Link></div>;
  }
  if (!tournament) {
    return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading...</div>;
  }

  const tables = groupBy(standings, (row) => row.group || 'Points Table');
  const hasLeague = fixtures.some((f) => f.stage !== 'knockout');
  const leagueRounds = groupBy(fixtures.filter((f) => f.stage !== 'knockout'), (f) => f.round);
  const knockoutRounds = groupBy(fixtures.filter((f) => f.stage === 'knockout'), (f) => f.round);
  const champion = fixtures.find((f) => f.stage === 'knockout' && f.round === 'Final')?.winner;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-8">
      <Link href="/tournaments" className="inline-flex items-center text-slate-400 hover:text-white mb-6">
        <ChevronLeft className="w-5 h-5 mr-1" /> Tournaments
      </Link>

      <div className="glass-panel p-6 mb-8 text-center bg-gradient-to-br from-primary/10 to-transparent">
        <Trophy className="w-10 h-10 mx-auto text-yellow-400 mb-3" />
        <h1 className="text-3xl font-bold mb-2">{tournament.name}</h1>
        <p className="text-slate-400 uppercase tracking-widest text-sm">{FORMAT_LABEL[tournament.format]} · {tournament.status.replace('-', ' ')}</p>
        {champion && <p className="mt-3 text-yellow-400 font-bold">Champions: {champion.name}</p>}
      </div>

      <div className={`grid grid-cols-1 ${hasLeague ? 'lg:grid-cols-2' : ''} gap-8 max-w-6xl mx-auto`}>
        {hasLeague && (
          <div className="space-y-8">
            {tables.map(([title, rows]) => (
              <div key={title} className="glass-panel p-6">
                <h2 className="text-xl font-bold mb-4">{title}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 text-sm">
                        <th className="pb-3 pr-4 font-medium">Team</th>
                        <th className="pb-3 px-2 font-medium">P</th>
                        <th className="pb-3 px-2 font-medium">W</th>
                        <th className="pb-3 px-2 font-medium">L</th>
                        <th className="pb-3 px-2 font-medium">T/NR</th>
                        <th className="pb-3 px-2 font-medium">Pts</th>
                        <th className="pb-3 pl-2 font-medium">NRR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((team, idx) => (
                        <tr key={team.teamId} className="border-b border-white/5 last:border-0">
                          <td className="py-4 pr-4 font-semibold flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-slate-400">{idx + 1}</span>
                            {team.teamName}
                          </td>
                          <td className="py-4 px-2">{team.played}</td>
                          <td className="py-4 px-2 text-green-400">{team.won}</td>
                          <td className="py-4 px-2 text-red-400">{team.lost}</td>
                          <td className="py-4 px-2 text-slate-400">{team.tied + team.noResult}</td>
                          <td className="py-4 px-2 font-bold text-primary">{team.points}</td>
                          <td className="py-4 pl-2 font-mono text-sm">{team.nrr > 0 ? '+' : ''}{team.nrr.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {standings.length === 0 && <p className="text-center text-slate-500">No standings available yet.</p>}
          </div>
        )}

        <div className="glass-panel p-6 space-y-6">
          <h2 className="text-xl font-bold">Fixtures & Results</h2>
          {[...leagueRounds, ...knockoutRounds].map(([round, list]) => (
            <div key={round} className="space-y-3">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{round}</h3>
              {list.map((fixture) => <FixtureRow key={fixture._id} fixture={fixture} />)}
            </div>
          ))}
          {fixtures.length === 0 && (
            <div className="text-center text-slate-500 py-4">No fixtures generated.</div>
          )}
        </div>
      </div>
    </div>
  );
}
