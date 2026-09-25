"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Save, Plus } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function MatchScoring() {
  const params = useParams();
  const matchSlug = params.matchSlug as string;

  const [runs, setRuns] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [overs, setOvers] = useState(0);
  const [balls, setBalls] = useState(0);

  // Example scoring function
  const addRuns = (r: number) => {
    setRuns(prev => prev + r);
    addBall();
  };

  const addBall = () => {
    setBalls(prev => {
      if (prev === 5) {
        setOvers(o => o + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const addWicket = () => {
    setWickets(prev => prev + 1);
    addBall();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <header className="glass-panel rounded-none border-t-0 border-l-0 border-r-0 border-b border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center text-slate-300 hover:text-white transition-colors">
          <ChevronLeft className="w-6 h-6 mr-1" /> Back
        </Link>
        <div className="font-semibold">Live Score</div>
        <button className="text-primary hover:text-primary-dark p-2">
          <Save className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 p-4 flex flex-col max-w-2xl mx-auto w-full">
        {/* Scorecard Summary */}
        <div className="glass-panel p-6 mb-6 text-center shadow-lg shadow-primary/5 border border-primary/20 bg-gradient-to-br from-slate-800 to-slate-900">
          <h2 className="text-slate-400 text-sm font-medium mb-1 uppercase tracking-wider">Batting: Team A</h2>
          <div className="text-6xl font-black text-white tracking-tighter mb-2">
            {runs} <span className="text-3xl text-slate-400 font-bold">/ {wickets}</span>
          </div>
          <div className="text-xl text-slate-300 font-medium">
            Overs: {overs}.{balls}
          </div>
        </div>

        {/* Current Batsmen / Bowler Placeholder */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="glass-panel p-4">
            <h3 className="text-xs text-slate-400 uppercase mb-2">Striker</h3>
            <p className="font-semibold text-lg text-white">Player One <span className="text-primary text-sm font-normal ml-2">12 (10)</span></p>
          </div>
          <div className="glass-panel p-4">
            <h3 className="text-xs text-slate-400 uppercase mb-2">Bowler</h3>
            <p className="font-semibold text-lg text-white">Player Two <span className="text-accent text-sm font-normal ml-2">0/14 (2.1)</span></p>
          </div>
        </div>

        {/* Big Tap Targets for Runs */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
          {[0, 1, 2, 3, 4, 6].map((run) => (
            <button 
              key={run} 
              onClick={() => addRuns(run)}
              className="glass-panel py-6 text-2xl font-bold hover:bg-white/10 active:bg-white/20 transition-colors flex items-center justify-center border-t border-white/5 shadow-md hover:shadow-xl active:scale-95"
            >
              {run}
            </button>
          ))}
          
          <button 
            onClick={addWicket}
            className="glass-panel py-6 text-2xl font-bold text-red-400 hover:bg-red-500/20 active:bg-red-500/30 transition-colors flex items-center justify-center border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)] col-span-1 sm:col-span-2 active:scale-95"
          >
            OUT
          </button>
        </div>

        {/* Extras & Tools */}
        <div className="grid grid-cols-4 gap-3 mt-auto">
          {['WD', 'NB', 'B', 'LB'].map(extra => (
            <button key={extra} className="glass-panel py-3 text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
              {extra}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
