"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Activity, Users, Trophy, ShieldAlert, LogOut, Search } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<{ id: string, name: string, roles: string[] } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('mcc_token');
    const userData = localStorage.getItem('mcc_user');
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('mcc_token');
    localStorage.removeItem('mcc_user');
    setUser(null);
    router.refresh();
  };

  if (user) {
    return (
      <main className="min-h-screen flex flex-col p-6 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto w-full z-10 relative mt-12">
          <header className="flex justify-between items-center mb-12">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
                Welcome back, {user.name.split(' ')[0]}
              </h1>
              <p className="text-slate-400">Your personalized cricket dashboard.</p>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Player Profile Link */}
            <Link href={`/players/${user.id}`} className="glass-panel p-6 flex flex-col items-center justify-center text-center hover:bg-white/10 transition-all hover:-translate-y-1">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mb-4 text-accent">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg text-white mb-1">My Profile</h3>
              <p className="text-sm text-slate-400">View your career stats and match history.</p>
            </Link>

            {/* Tournaments Link */}
            <Link href="/tournaments" className="glass-panel p-6 flex flex-col items-center justify-center text-center hover:bg-white/10 transition-all hover:-translate-y-1">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4 text-yellow-500">
                <Trophy className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg text-white mb-1">Tournaments</h3>
              <p className="text-sm text-slate-400">Follow live standings and brackets.</p>
            </Link>

            {/* Live Matches Link */}
            <Link href="/tournaments" className="glass-panel p-6 flex flex-col items-center justify-center text-center hover:bg-white/10 transition-all hover:-translate-y-1">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4 text-green-500">
                <Activity className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg text-white mb-1">Live Scores</h3>
              <p className="text-sm text-slate-400">Watch ball-by-ball updates in real-time.</p>
            </Link>

            {/* Admin Panel (Conditionally Rendered) */}
            {(user.roles.includes('admin') || user.roles.includes('scorer')) && (
              <Link href="/admin" className="glass-panel p-6 flex flex-col items-center justify-center text-center border-red-500/30 hover:bg-red-500/10 transition-all hover:-translate-y-1 md:col-span-2 lg:col-span-3 mt-4">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-500">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-lg text-white mb-1">Admin & Scorer Panel</h3>
                <p className="text-sm text-slate-400">Manage matches, create tournaments, and score live games.</p>
              </Link>
            )}

          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="glass-panel p-10 max-w-4xl w-full flex flex-col items-center text-center z-10 relative">
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary/30">
          <Trophy className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
          Village Cricket Club
        </h1>
        <p className="text-lg text-slate-300 max-w-2xl mb-12">
          Experience the modern way to score matches, track player stats, and follow live tournaments. 
          Everything you need for your local cricket club, right in your pocket.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-12">
          <div className="bg-white/5 border border-white/5 rounded-xl p-6 flex flex-col items-center text-center hover:bg-white/10 transition-colors">
            <Activity className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-semibold text-white mb-2">Live Scoring</h3>
            <p className="text-sm text-slate-400">Ball-by-ball updates broadcasted in real-time to everyone.</p>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-xl p-6 flex flex-col items-center text-center hover:bg-white/10 transition-colors">
            <Users className="w-8 h-8 text-accent mb-3" />
            <h3 className="font-semibold text-white mb-2">Player Profiles</h3>
            <p className="text-sm text-slate-400">Deep career stats, match histories, and trend analytics.</p>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-xl p-6 flex flex-col items-center text-center hover:bg-white/10 transition-colors">
            <Trophy className="w-8 h-8 text-yellow-400 mb-3" />
            <h3 className="font-semibold text-white mb-2">Tournaments</h3>
            <p className="text-sm text-slate-400">Auto-generated draws, live standings, and brackets.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/login" className="btn-primary flex items-center justify-center gap-2">
            Sign In / Register <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/tournaments" className="px-6 py-3 rounded-xl font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/5">
            View Live Matches
          </Link>
        </div>
      </div>
    </main>
  );
}
