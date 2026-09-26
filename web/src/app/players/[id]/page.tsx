"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, User, TrendingUp, Activity } from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';

export default function PlayerProfile() {
  const params = useParams();
  const id = params.id as string;

  const [player, setPlayer] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);

  useEffect(() => {
    // We assume backend has a /players/:id endpoint for info, and /players/:id/trends
    api.get(`/players/${id}`).then(res => {
      setPlayer(res.data);
    }).catch(err => console.error(err));

    api.get(`/players/${id}/trends`).then(res => {
       // Expecting array of { matchDate, runs, wickets }
       setTrends(res.data.trends || []);
       setStats(res.data.careerStats);
    }).catch(err => console.error(err));
  }, [id]);

  if (!player || !stats) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Activity className="animate-spin w-8 h-8 text-primary"/></div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-8">
      <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white mb-6">
        <ChevronLeft className="w-5 h-5 mr-1" /> Back
      </Link>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profile Header */}
        <div className="glass-panel p-6 sm:p-10 flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
          
          <div className="w-24 h-24 sm:w-32 sm:h-32 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-700 shadow-xl shrink-0">
             <User className="w-12 h-12 text-slate-500" />
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">{player.name}</h1>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-slate-300 font-medium tracking-wide">
                {player.role || 'Player'}
              </span>
              <span className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary font-medium tracking-wide">
                {player.battingStyle || 'Right-hand bat'}
              </span>
            </div>
          </div>
        </div>

        {/* Career Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-panel p-5 text-center">
             <div className="text-slate-400 text-sm font-medium mb-1">Matches</div>
             <div className="text-3xl font-bold text-white">{stats.matchesPlayed || 0}</div>
          </div>
          <div className="glass-panel p-5 text-center">
             <div className="text-slate-400 text-sm font-medium mb-1">Total Runs</div>
             <div className="text-3xl font-bold text-primary">{stats.totalRuns || 0}</div>
          </div>
          <div className="glass-panel p-5 text-center">
             <div className="text-slate-400 text-sm font-medium mb-1">Wickets</div>
             <div className="text-3xl font-bold text-accent">{stats.totalWickets || 0}</div>
          </div>
          <div className="glass-panel p-5 text-center">
             <div className="text-slate-400 text-sm font-medium mb-1">Strike Rate</div>
             <div className="text-3xl font-bold text-white">
               {stats.ballsFaced ? ((stats.totalRuns / stats.ballsFaced) * 100).toFixed(1) : '0.0'}
             </div>
          </div>
        </div>

        {/* Form Guide / Trends Chart */}
        <div className="glass-panel p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Form Guide
          </h2>
          {trends.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="matchDate" stroke="#94a3b8" tick={{fontSize: 12}} />
                  <YAxis yAxisId="left" stroke="#38bdf8" tick={{fontSize: 12}} />
                  <YAxis yAxisId="right" orientation="right" stroke="#a78bfa" tick={{fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="runs" name="Runs" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, fill: '#0f172a', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="wickets" name="Wickets" stroke="#a78bfa" strokeWidth={3} dot={{ r: 4, fill: '#0f172a', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
             <div className="py-12 text-center text-slate-500">Not enough match data to display trends.</div>
          )}
        </div>

      </div>
    </div>
  );
}
