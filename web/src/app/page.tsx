import Link from 'next/link';
import { ArrowRight, Activity, Users, Trophy } from 'lucide-react';

export default function Home() {
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
