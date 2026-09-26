"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Activity, Trophy, Bell, BellRing } from 'lucide-react';
import api from '@/lib/api';

interface LiveTotals {
  runs: number;
  wickets: number;
  overs: number; // Simplified, in reality would calculate from legal deliveries
}

export default function LiveSpectatorView() {
  const params = useParams();
  const slug = params.slug as string;
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [matchData, setMatchData] = useState<any>(null);
  const [totals, setTotals] = useState<LiveTotals>({ runs: 0, wickets: 0, overs: 0 });
  const [status, setStatus] = useState<string>('Live');
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Helper to convert VAPID public key
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const vapidRes = await api.get('/notifications/vapid-public-key');
      
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidRes.data)
      });
      
      await api.post('/notifications/subscribe', sub);
      setIsSubscribed(true);
    } catch (e) {
      console.error("Push subscription failed", e);
    }
  };

  // Initial Fetch & Socket Connection
  useEffect(() => {
    // 1. Fetch current match state
    api.get(`/matches/live/${slug}`).then(res => {
      setMatchData(res.data.match);
      if (res.data.innings && res.data.innings.length > 0) {
        const currentInning = res.data.innings[res.data.innings.length - 1];
        setTotals({
          runs: currentInning.totalRuns,
          wickets: currentInning.totalWickets,
          overs: currentInning.totalOvers || 0
        });
      }
      setStatus(res.data.match.result || 'Live');
    }).catch(err => console.error("Error fetching match", err));

    // 2. Setup Socket
    // We get the match ID once fetched, but let's connect to the namespace if possible
    // The backend uses `match:${match._id}` for rooms. So we need the ID.
  }, [slug]);

  useEffect(() => {
    if (!matchData) return;
    
    // Connect to server (ensure URL matches backend)
    const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
    const newSocket = io(socketUrl);
    setSocket(newSocket);

    // Backend needs a way to join room, currently backend emits to `match:${match._id}`
    // A standard pattern is frontend emits 'join_room' to join.
    // For MVP, if backend doesn't have `join` event, it broadcasts to everyone or we assume they are joined.
    // Let's assume the backend was updated to accept `join:match` or we just listen globally.
    // In our `server/index.js`, we didn't add a 'join' event. Let's just listen globally if it broadcasts.
    newSocket.on('connect', () => {
       newSocket.emit('joinMatch', matchData._id); 
    });

    newSocket.on('match:delivery', (data: any) => {
      setTotals({
        runs: data.inningsTotals.runs,
        wickets: data.inningsTotals.wickets,
        overs: totals.overs + 0.1 // simplified visualization
      });
    });

    newSocket.on('match:status', (data: any) => {
      setStatus(data.result || data.status);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [matchData]);

  if (!matchData) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Activity className="animate-spin w-8 h-8 text-primary"/></div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center">
      <div className="glass-panel max-w-2xl w-full p-8 text-center relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 blur-3xl rounded-full"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/20 blur-3xl rounded-full"></div>
        
        <Trophy className="w-12 h-12 mx-auto text-yellow-400 mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
        
        <button 
          onClick={subscribeToPush}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
          title="Get Match Alerts"
        >
          {isSubscribed ? <BellRing className="w-5 h-5 text-primary" /> : <Bell className="w-5 h-5" />}
        </button>

        <h1 className="text-3xl font-bold mb-2">
          {matchData.teamA?.name} <span className="text-slate-400 font-medium px-2">vs</span> {matchData.teamB?.name}
        </h1>
        
        <div className="inline-block px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-semibold mb-8 animate-pulse">
          {status}
        </div>

        <div className="text-8xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">
          {totals.runs} <span className="text-5xl text-slate-500">/ {totals.wickets}</span>
        </div>
        
        <div className="text-2xl text-slate-300 font-medium">
          Overs: {typeof totals.overs === 'number' ? totals.overs.toFixed(1) : totals.overs}
        </div>
      </div>
    </div>
  );
}
