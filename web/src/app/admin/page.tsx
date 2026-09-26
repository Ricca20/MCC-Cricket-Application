"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Trophy, Users, Edit3, Settings, ShieldAlert, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'tournaments' | 'matches'>('tournaments');
  
  // Dummy states for the UI forms to show they are "wired" conceptually
  const [tournamentName, setTournamentName] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/tournaments', { name: tournamentName, format: 'knockout', startDate: new Date() });
      setSuccessMsg('Tournament created successfully!');
      setTournamentName('');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      {/* Mobile-optimized Header */}
      <header className="glass-panel sticky top-0 z-50 rounded-none border-t-0 border-l-0 border-r-0 border-b border-white/10 px-4 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between w-full">
          <Link href="/" className="flex items-center text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6 mr-1" />
          </Link>
          <div className="font-bold text-lg tracking-wide flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" /> Admin Panel
          </div>
          <div className="w-6 h-6"></div> {/* Spacer for centering */}
        </div>
        
        {/* Modern Mobile Tab Bar */}
        <div className="flex w-full bg-slate-800/50 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('tournaments')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'tournaments' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Tournaments
          </button>
          <button 
            onClick={() => setActiveTab('matches')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'matches' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Matches
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-lg mx-auto space-y-6 mt-4">
        {successMsg && (
          <div className="glass-panel bg-green-500/10 border-green-500/30 text-green-400 p-4 rounded-xl flex items-center gap-3 transition-opacity duration-300">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{successMsg}</p>
          </div>
        )}

        {activeTab === 'tournaments' ? (
          <div className="space-y-6 transition-all duration-300">
            {/* Create Tournament Card */}
            <div className="glass-panel p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 text-primary">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">New Tournament</h2>
                  <p className="text-xs text-slate-400">Initialize a new cup</p>
                </div>
              </div>
              
              <form onSubmit={handleCreateTournament} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Tournament Name</label>
                  <input 
                    type="text" 
                    value={tournamentName}
                    onChange={(e) => setTournamentName(e.target.value)}
                    className="input-field w-full text-base py-3" 
                    placeholder="e.g. Summer Cup 2026" 
                    required 
                  />
                </div>
                <button type="submit" className="btn-primary w-full py-3.5 text-sm uppercase tracking-wider font-bold">
                  Create Tournament
                </button>
              </form>
            </div>

            {/* Quick Actions Grid */}
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-2">Manage Active</h3>
            <div className="grid grid-cols-2 gap-4">
              <button className="glass-panel p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/5 transition-colors active:scale-95">
                <Users className="w-6 h-6 text-accent" />
                <span className="text-xs font-medium text-slate-300">Add Teams</span>
              </button>
              <button className="glass-panel p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/5 transition-colors active:scale-95">
                <Settings className="w-6 h-6 text-slate-400" />
                <span className="text-xs font-medium text-slate-300">Generate Draw</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 transition-all duration-300">
            {/* Match Correction Card */}
            <div className="glass-panel p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30 text-accent">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Fix Delivery</h2>
                  <p className="text-xs text-slate-400">Correct scorer mistakes</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Match ID</label>
                  <input type="text" className="input-field w-full" placeholder="Paste match ID..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Delivery ID</label>
                  <input type="text" className="input-field w-full" placeholder="Paste delivery ID..." />
                </div>
                <button className="glass-panel w-full py-3.5 text-sm uppercase tracking-wider font-bold text-accent border border-accent/30 hover:bg-accent/10 transition-colors">
                  Fetch Delivery
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
