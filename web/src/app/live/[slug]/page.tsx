"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Activity, Trophy, Radio } from 'lucide-react';
import api from '@/lib/api';
import { io, Socket } from 'socket.io-client';

export default function LiveScoreboard() {
  const params = useParams();
  const slug = params.slug as string;

  const [match, setMatch] = useState<any>(null);
  const [innings, setInnings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [recentDeliveries, setRecentDeliveries] = useState<any[]>([]);

  useEffect(() => {
    // 1. Fetch initial match data
    const fetchMatch = async () => {
      try {
        const res = await api.get(`/matches/live/${slug}`);
        setMatch(res.data.match);
        const currentInnings = res.data.innings[res.data.innings.length - 1]; // Latest innings
        setInnings(currentInnings);
        
        // Populate recent deliveries
        if (currentInnings?.deliveries) {
           setRecentDeliveries(currentInnings.deliveries.slice(-6).reverse());
        }
        
        setLoading(false);
        setupSocket(res.data.match._id);
      } catch (err: any) {
        console.error(err);
        setError('Match not found or not live.');
        setLoading(false);
      }
    };

    fetchMatch();

    // Socket variable for cleanup
    let socket: Socket;

    const setupSocket = (matchId: string) => {
      // Connect to socket server
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const socketUrl = backendUrl.replace('/api', '');
      
      socket = io(socketUrl);

      socket.on('connect', () => {
        setSocketConnected(true);
        socket.emit('joinMatch', matchId);
      });

      socket.on('disconnect', () => {
        setSocketConnected(false);
      });

      // Listen for ball-by-ball updates
      socket.on('match:delivery', (data: { inningsTotals: { runs: number, wickets: number }, delivery: any }) => {
        setInnings((prev: any) => ({
          ...prev,
          totalRuns: data.inningsTotals.runs,
          totalWickets: data.inningsTotals.wickets,
          // Recalculate overs (simplified)
          totalOvers: Math.floor(((prev?.deliveries?.length || 0) + 1) / 6) + (((prev?.deliveries?.length || 0) + 1) % 6) / 10
        }));
        
        setRecentDeliveries(prev => [data.delivery, ...prev].slice(0, 6));
      });
      
      // Listen for match complete
      socket.on('match:status', (data: { status: string, result: string }) => {
        setMatch((prev: any) => ({
          ...prev,
          status: data.status,
          result: data.result
        }));
      });
    };

    return () => {
      if (socket) socket.disconnect();
    };
  }, [slug]);

  if (loading) return <div className="min-h-screen bg-[#0B1120] flex items-center justify-center"><Activity className="animate-spin text-primary w-10 h-10" /></div>;
  if (error) return <div className="min-h-screen bg-[#0B1120] text-white flex flex-col items-center justify-center p-6"><AlertTriangle className="w-16 h-16 text-red-500 mb-4" /><h2 className="text-xl font-bold">{error}</h2><Link href="/" className="mt-6 text-primary hover:underline">Return to Dashboard</Link></div>;

  return (
    <div className="min-h-screen bg-[#0B1120] text-white pb-20 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-accent/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 space-y-8 relative z-10">
        
        {/* Navigation & Status */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white transition-colors group">
            <div className="bg-slate-800/80 p-2.5 rounded-full mr-3 group-hover:bg-slate-700 transition-colors border border-slate-700/50">
              <ChevronLeft className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm uppercase tracking-wider hidden sm:block">Dashboard</span>
          </Link>
          
          <div className="flex items-center gap-3">
            {socketConnected ? (
               <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold tracking-widest uppercase border border-green-500/30">
                 <Radio className="w-3 h-3 animate-pulse" /> Live
               </div>
            ) : (
               <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 text-slate-400 rounded-full text-xs font-bold tracking-widest uppercase border border-slate-700">
                 <Activity className="w-3 h-3" /> Reconnecting...
               </div>
            )}
            {match.status === 'completed' && (
              <div className="flex items-center gap-2 px-3 py-1 bg-accent/20 text-accent rounded-full text-xs font-bold tracking-widest uppercase border border-accent/30">
                Completed
              </div>
            )}
          </div>
        </div>

        {/* Main Scoreboard Card */}
        <div className="glass-panel overflow-hidden border-0 shadow-2xl bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10 p-8 text-center relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
          
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-6 flex justify-center items-center gap-4">
              <span>{match.teamA.name}</span>
              <span className="text-slate-600 text-lg">vs</span>
              <span>{match.teamB.name}</span>
            </h1>

            <div className="my-8">
              <div className="text-7xl sm:text-9xl font-black text-white drop-shadow-2xl tracking-tighter flex items-baseline justify-center">
                {innings?.totalRuns || 0}
                <span className="text-4xl sm:text-6xl text-slate-500 mx-2 font-light">/</span>
                <span className="text-primary">{innings?.totalWickets || 0}</span>
              </div>
              <p className="text-slate-400 text-lg sm:text-xl font-bold uppercase tracking-widest mt-4">
                Overs: <span className="text-white">{innings?.totalOvers || '0.0'}</span> / {match.oversLimit}
              </p>
            </div>
            
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
             {recentDeliveries.length === 0 ? (
               <p className="text-slate-500 text-sm">No deliveries yet.</p>
             ) : (
               recentDeliveries.map((ball, i) => (
                 <div key={i} className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-lg border ${
                   ball.wicket ? 'bg-red-500/20 text-red-400 border-red-500/30' : 
                   ball.extraType ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 
                   ball.runs === 4 || ball.runs === 6 ? 'bg-primary/20 text-primary border-primary/30' : 
                   'bg-slate-800 text-white border-slate-700'
                 }`}>
                   {ball.wicket ? 'W' : (ball.runs + (ball.extraType ? ball.extraType[0] : ''))}
                 </div>
               ))
             )}
           </div>
        </div>
        
      </div>
    </div>
  );
}
// Using this alert icon here to avoid full import block edits above
function AlertTriangle(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>;
}
