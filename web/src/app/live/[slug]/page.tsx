"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Activity, Trophy, Radio, AlertTriangle, Share2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import api, { SOCKET_URL } from '@/lib/api';
import { ballLabel } from '@/lib/cricket';
import type { Innings, Match } from '@/lib/types';

export default function LiveScoreboard() {
  const params = useParams();
  const slug = params.slug as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [inningsList, setInningsList] = useState<Innings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMatch = useCallback(() =>
    api.get<{ match: Match; innings: Innings[] }>(`/matches/live/${slug}`)
      .then((res) => {
        setMatch(res.data.match);
        setInningsList(res.data.innings);
        setError('');
        return res.data.match;
      })
      .catch(() => {
        setError('Match not found.');
        return null;
      })
      .finally(() => setLoading(false)), [slug]);

  useEffect(() => {
    let socket: Socket | null = null;
    let cancelled = false;

    fetchMatch().then((loaded) => {
      if (!loaded || cancelled) return;
      socket = io(SOCKET_URL);
      socket.on('connect', () => {
        setSocketConnected(true);
        socket!.emit('joinMatch', loaded._id);
      });
      socket.on('disconnect', () => setSocketConnected(false));
      // The server sends "something changed"; refetch so totals always match it.
      // Debounced so a burst of balls (e.g. an offline sync) is one request.
      socket.on('match:update', () => {
        if (refetchTimer.current) clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(fetchMatch, 300);
      });
    });

    return () => {
      cancelled = true;
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      socket?.disconnect();
    };
  }, [slug, fetchMatch]);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: document.title, url }).catch(() => {});
    else await navigator.clipboard.writeText(url);
  };

  if (loading) return <div className="min-h-screen bg-[#0B1120] flex items-center justify-center"><Activity className="animate-spin text-primary w-10 h-10" /></div>;
  if (error || !match) return <div className="min-h-screen bg-[#0B1120] text-white flex flex-col items-center justify-center p-6"><AlertTriangle className="w-16 h-16 text-red-500 mb-4" /><h2 className="text-xl font-bold">{error}</h2><Link href="/" className="mt-6 text-primary hover:underline">Return to Dashboard</Link></div>;

  const current = inningsList.find((i) => i.status === 'in-progress') || inningsList.at(-1);
  const recent = (current?.deliveries || []).slice(-6).reverse();

  return (
    <div className="min-h-screen bg-[#0B1120] text-white pb-20 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-accent/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 space-y-8 relative z-10">

        {/* Navigation & Status */}
        <div className="flex items-center justify-between">
          <Link href="/live" className="inline-flex items-center text-slate-400 hover:text-white transition-colors group">
            <div className="bg-slate-800/80 p-2.5 rounded-full mr-3 group-hover:bg-slate-700 transition-colors border border-slate-700/50">
              <ChevronLeft className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm uppercase tracking-wider hidden sm:block">All matches</span>
          </Link>

          <div className="flex items-center gap-3">
            {match.status === 'completed' ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-accent/20 text-accent rounded-full text-xs font-bold tracking-widest uppercase border border-accent/30">
                Completed
              </div>
            ) : match.status === 'upcoming' ? (
              <div className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-xs font-bold tracking-widest uppercase border border-slate-700">
                Starts soon
              </div>
            ) : socketConnected ? (
               <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold tracking-widest uppercase border border-green-500/30">
                 <Radio className="w-3 h-3 animate-pulse" /> Live
               </div>
            ) : (
               <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 text-slate-400 rounded-full text-xs font-bold tracking-widest uppercase border border-slate-700">
                 <Activity className="w-3 h-3" /> Reconnecting...
               </div>
            )}
            <button onClick={share} className="text-slate-400 hover:text-white" title="Share"><Share2 className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Main Scoreboard Card */}
        <div className="glass-panel overflow-hidden border-0 shadow-2xl bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10 p-8 text-center relative">
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-6 flex justify-center items-center gap-4">
              <span>{match.teamA.name}</span>
              <span className="text-slate-600 text-lg">vs</span>
              <span>{match.teamB.name}</span>
            </h1>

            {current ? (
              <div className="my-8">
                <p className="text-slate-400 text-sm uppercase tracking-widest mb-2">{current.battingTeam}</p>
                <div className="text-7xl sm:text-9xl font-black text-white drop-shadow-2xl tracking-tighter flex items-baseline justify-center">
                  {current.totalRuns}
                  <span className="text-4xl sm:text-6xl text-slate-500 mx-2 font-light">/</span>
                  <span className="text-primary">{current.totalWickets}</span>
                </div>
                <p className="text-slate-400 text-lg sm:text-xl font-bold uppercase tracking-widest mt-4">
                  Overs: <span className="text-white">{current.totalOvers}</span> / {match.oversLimit}
                </p>
                {current.target && current.status === 'in-progress' && (
                  <p className="text-yellow-400 mt-3 font-semibold">
                    Target {current.target} · need {Math.max(0, current.target - current.totalRuns)} from {Math.max(0, match.oversLimit * 6 - current.legalBalls)} balls
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-400 my-8">The toss hasn&apos;t happened yet.</p>
            )}

            {inningsList.length > 1 && (
              <div className="flex justify-center gap-6 text-sm text-slate-400">
                {inningsList.map((inn) => (
                  <span key={inn._id}>{inn.battingTeam}: <span className="text-white font-semibold">{inn.totalRuns}/{inn.totalWickets}</span> ({inn.totalOvers})</span>
                ))}
              </div>
            )}

            {match.status === 'completed' && match.result && (
              <div className="mt-8 py-3 px-6 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 font-bold rounded-xl inline-flex items-center gap-2">
                <Trophy className="w-5 h-5" /> {match.result}
              </div>
            )}
          </div>
        </div>

        {/* Recent Deliveries */}
        <div className="glass-panel p-6 bg-slate-900/40">
           <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Recent Balls</h3>
           <div className="flex flex-wrap gap-3">
             {recent.length === 0 ? (
               <p className="text-slate-500 text-sm">No deliveries yet.</p>
             ) : (
               recent.map((ball) => (
                 <div key={ball._id} className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-lg border ${
                   ball.wicket ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                   ball.extraType ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                   ball.runs === 4 || ball.runs === 6 ? 'bg-primary/20 text-primary border-primary/30' :
                   'bg-slate-800 text-white border-slate-700'
                 }`}>
                   {ballLabel(ball)}
                 </div>
               ))
             )}
           </div>
        </div>

      </div>
    </div>
  );
}
