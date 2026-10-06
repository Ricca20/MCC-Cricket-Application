"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Activity, UserPlus, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

export default function ScoreMatch() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [match, setMatch] = useState<any>(null);
  const [innings, setInnings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Delivery State
  const [runs, setRuns] = useState(0);
  const [extraType, setExtraType] = useState<string | null>(null);
  const [isWicket, setIsWicket] = useState(false);
  const [wicketType, setWicketType] = useState('bowled');
  
  // Players State (simplified for MVP: just text names if actual player selection is too complex, but let's use string inputs for MVP to avoid huge dropdowns if not seeded)
  const [batsmanName, setBatsmanName] = useState('Batter 1');
  const [bowlerName, setBowlerName] = useState('Bowler 1');

  useEffect(() => {
    fetchMatch();
  }, [id]);

  const fetchMatch = async () => {
    try {
      const token = localStorage.getItem('mcc_token');
      const res = await api.get(`/matches/${id}`, { headers: { Authorization: `Bearer ${token}` }});
      setMatch(res.data.match);
      setInnings(res.data.innings[0]); // Assumes 1st innings is active for MVP
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load match');
      setLoading(false);
    }
  };

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleSubmitDelivery = async () => {
    try {
      const token = localStorage.getItem('mcc_token');
      
      const deliveryPayload = {
        clientEntryId: generateUUID(),
        over: Math.floor((innings?.deliveries?.length || 0) / 6),
        ballInOver: (innings?.deliveries?.length || 0) % 6 + 1,
        bowlerName,
        batsmanName,
        runs,
        extraType,
        wicket: isWicket ? { type: wicketType } : null
      };

      await api.post(`/matches/${id}/deliveries`, deliveryPayload, { headers: { Authorization: `Bearer ${token}` }});
      
      // Reset state for next ball
      setRuns(0);
      setExtraType(null);
      setIsWicket(false);
      
      // Refresh match state to get updated totals
      fetchMatch();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to submit delivery');
    }
  };

  const handleCompleteMatch = async () => {
    if (!confirm('Are you sure you want to complete this match? Stats will be finalized.')) return;
    try {
      const token = localStorage.getItem('mcc_token');
      await api.post(`/matches/${id}/complete`, { result: `${match.teamA.name} won` }, { headers: { Authorization: `Bearer ${token}` }});
      router.push('/');
    } catch (err: any) {
      console.error(err);
      alert('Failed to complete match');
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Activity className="animate-spin text-primary w-10 h-10" /></div>;
  if (error) return <div className="min-h-screen bg-slate-900 text-white p-6"><div className="bg-red-500/20 p-4 text-red-400 rounded-xl">{error}</div></div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">
      {/* Header */}
      <header className="bg-slate-800 p-4 sticky top-0 z-50 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <Link href="/admin" className="text-slate-400 hover:text-white">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div className="font-bold text-lg text-center flex-1">
            {match.teamA.name} <span className="text-slate-500 font-normal mx-2">vs</span> {match.teamB.name}
          </div>
          <div className="w-6 h-6"></div>
        </div>
        
        {/* Live Score Board */}
        <div className="bg-slate-900 rounded-xl p-4 text-center border border-slate-700 shadow-inner">
          <div className="text-5xl font-black text-primary mb-1">
            {innings?.totalRuns || 0} <span className="text-slate-500 text-3xl font-medium">/</span> {innings?.totalWickets || 0}
          </div>
          <div className="text-slate-400 font-semibold tracking-widest text-sm uppercase">
            Overs: <span className="text-white">{innings?.totalOvers || '0.0'}</span> / {match.oversLimit}
          </div>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-6">
        
        {/* Active Players */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
            <label className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1 block">Striker</label>
            <input type="text" value={batsmanName} onChange={e => setBatsmanName(e.target.value)} className="w-full bg-transparent font-bold text-lg focus:outline-none" />
          </div>
          <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
            <label className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1 block">Bowler</label>
            <input type="text" value={bowlerName} onChange={e => setBowlerName(e.target.value)} className="w-full bg-transparent font-bold text-lg focus:outline-none text-accent" />
          </div>
        </div>

        {/* Scoring Controls */}
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
          <h3 className="font-bold mb-4 text-slate-300">Runs Scored off Bat</h3>
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[0, 1, 2, 3, 4, 6].map(num => (
              <button 
                key={num}
                onClick={() => setRuns(num)}
                className={`py-4 rounded-xl font-black text-xl transition-all ${runs === num ? 'bg-primary text-white scale-105 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                {num}
              </button>
            ))}
          </div>

          <h3 className="font-bold mb-3 text-slate-300">Extras</h3>
          <div className="grid grid-cols-4 gap-2 mb-6">
            {['WD', 'NB', 'B', 'LB'].map(type => (
              <button 
                key={type}
                onClick={() => setExtraType(extraType === type ? null : type)}
                className={`py-2 rounded-lg font-bold text-sm transition-all ${extraType === type ? 'bg-yellow-500 text-white' : 'bg-slate-700 text-slate-400'}`}
              >
                {type}
              </button>
            ))}
          </div>

          <h3 className="font-bold mb-3 text-red-400">Wicket?</h3>
          <div className="flex gap-4 items-center">
            <button 
              onClick={() => setIsWicket(!isWicket)}
              className={`flex-1 py-3 rounded-xl font-black text-lg transition-all ${isWicket ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-slate-700 text-red-400 border border-red-500/30'}`}
            >
              WICKET
            </button>
            {isWicket && (
              <select value={wicketType} onChange={e => setWicketType(e.target.value)} className="bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm font-semibold focus:outline-none">
                <option value="bowled">Bowled</option>
                <option value="caught">Caught</option>
                <option value="lbw">LBW</option>
                <option value="run out">Run Out</option>
                <option value="stumped">Stumped</option>
              </select>
            )}
          </div>
        </div>

        {/* Action Button */}
        <button 
          onClick={handleSubmitDelivery}
          className="w-full bg-gradient-to-r from-primary to-emerald-400 text-white font-black text-xl py-5 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-6 h-6" /> SUBMIT BALL
        </button>

        {/* Complete Match */}
        <div className="pt-8 border-t border-slate-800">
           <button onClick={handleCompleteMatch} className="w-full bg-slate-800 hover:bg-slate-700 text-red-400 font-bold py-4 rounded-xl border border-slate-700 transition-all flex justify-center items-center gap-2">
             <AlertTriangle className="w-5 h-5" /> End & Finalize Match
           </button>
        </div>

      </main>
    </div>
  );
}
