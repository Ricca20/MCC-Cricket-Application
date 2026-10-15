"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { ChevronLeft, Activity, CheckCircle2, AlertTriangle, Undo2, CloudOff, Link2, Flag } from 'lucide-react';
import api, { errorMessage } from '@/lib/api';
import { useOnline } from '@/lib/hooks';
import { db, syncOfflineDeliveries, DeliveryPayload, PlayerRef, QueuedDelivery } from '@/lib/db';
import { EXTRA_LABELS, EXTRA_TYPES, ExtraType, FIELDER_WICKETS, WICKET_TYPES, WicketType, ballLabel, formatOvers, isLegal } from '@/lib/cricket';
import type { Innings, Match, RosterPlayer, Side } from '@/lib/types';

interface Crease {
  inningsNumber: number;
  striker: PlayerRef | null;
  nonStriker: PlayerRef | null;
  bowler: PlayerRef | null;
  lastOverBowler: string | null;
}

const emptyCrease = (inningsNumber: number): Crease => ({
  inningsNumber, striker: null, nonStriker: null, bowler: null, lastOverBowler: null
});

const creaseKey = (matchId: string) => `mcc_crease_${matchId}`;

const loadCrease = (matchId: string): Crease | null => {
  try {
    const raw = localStorage.getItem(creaseKey(matchId));
    return raw ? (JSON.parse(raw) as Crease) : null;
  } catch {
    return null;
  }
};

const sameName = (a: PlayerRef | null | undefined, b: PlayerRef | null | undefined) =>
  Boolean(a && b && a.name.trim().toLowerCase() === b.name.trim().toLowerCase());

const OTHER = '__other__';

// Roster dropdown with a free-text fallback for players not on the team sheet
function PlayerPicker({ label, roster, value, exclude, onChange }: {
  label: string;
  roster: RosterPlayer[];
  value: PlayerRef | null;
  exclude: (PlayerRef | null | undefined)[];
  onChange: (player: PlayerRef | null) => void;
}) {
  const options = roster.filter((p) => !exclude.some((e) => sameName(e, p)));
  const onRoster = value && roster.some((p) => sameName(p, value));
  const [typing, setTyping] = useState(Boolean(value && !onRoster));

  return (
    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
      <label className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1 block">{label}</label>
      {typing ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="text"
            placeholder="Player name"
            value={value?.name || ''}
            onChange={(e) => onChange(e.target.value.trim() ? { name: e.target.value } : null)}
            className="w-full bg-transparent font-bold text-lg focus:outline-none"
          />
          {roster.length > 0 && (
            <button type="button" onClick={() => { setTyping(false); onChange(null); }} className="text-xs text-slate-400">List</button>
          )}
        </div>
      ) : (
        <select
          value={value ? value.name : ''}
          onChange={(e) => {
            if (e.target.value === OTHER) { setTyping(true); onChange(null); return; }
            const player = roster.find((p) => p.name === e.target.value);
            onChange(player ? { id: player.userId || null, name: player.name } : null);
          }}
          className="w-full bg-transparent font-bold text-lg focus:outline-none"
        >
          <option value="">Select…</option>
          {value && onRoster && <option value={value.name}>{value.name}</option>}
          {options.filter((p) => !sameName(p, value)).map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          <option value={OTHER}>Other (type a name)…</option>
        </select>
      )}
    </div>
  );
}

export default function ScoreMatch() {
  const params = useParams();
  const id = params.id as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [inningsList, setInningsList] = useState<Innings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  // Only rendered after the match loads, so reading localStorage here can't cause a hydration mismatch
  const [savedCrease, setCrease] = useState<Crease | null>(() => (typeof window === 'undefined' ? null : loadCrease(id)));
  const [history, setHistory] = useState<Crease[]>([]);
  const [queue, setQueue] = useState<QueuedDelivery[]>([]);
  const online = useOnline();

  // Ball form
  const [runs, setRuns] = useState(0);
  const [extraType, setExtraType] = useState<ExtraType | null>(null);
  const [isWicket, setIsWicket] = useState(false);
  const [wicketType, setWicketType] = useState<WicketType>('bowled');
  const [outEnd, setOutEnd] = useState<'striker' | 'nonStriker'>('striker');
  const [fielder, setFielder] = useState<PlayerRef | null>(null);

  // Toss form
  const [tossWinner, setTossWinner] = useState<Side>('A');
  const [decision, setDecision] = useState<'bat' | 'bowl'>('bat');

  const current = useMemo(
    () => inningsList.find((i) => i.status === 'in-progress') || null,
    [inningsList]
  );

  // A new innings starts with an empty crease
  const crease = current && savedCrease?.inningsNumber !== current.inningsNumber
    ? emptyCrease(current.inningsNumber)
    : savedCrease;

  const fetchMatch = useCallback(() =>
    api.get<{ match: Match; innings: Innings[] }>(`/matches/${id}`)
      .then((res) => {
        setMatch(res.data.match);
        setInningsList(res.data.innings);
        setError('');
      })
      .catch((err) => {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status) setError(status === 401 ? 'Please sign in to score this match.' : errorMessage(err, 'Failed to load match'));
      })
      .finally(() => setLoading(false)), [id]);

  const refreshQueue = useCallback(async () => {
    setQueue(await db.deliveriesQueue.where({ matchId: id }).sortBy('id'));
  }, [id]);

  const sync = useCallback(async () => {
    const result = await syncOfflineDeliveries(api, id);
    await refreshQueue();
    if (result.synced || result.failed) await fetchMatch();
    return result;
  }, [id, fetchMatch, refreshQueue]);

  useEffect(() => {
    const goOnline = () => { sync(); };
    window.addEventListener('online', goOnline);
    fetchMatch().then(() => sync());
    const timer = setInterval(() => { if (navigator.onLine) sync(); }, 15000);
    return () => {
      window.removeEventListener('online', goOnline);
      clearInterval(timer);
    };
  }, [id, fetchMatch, sync]);

  useEffect(() => {
    if (crease) localStorage.setItem(creaseKey(id), JSON.stringify(crease));
  }, [crease, id]);

  const pending = queue.filter((q) => q.status !== 'failed');
  const failed = queue.filter((q) => q.status === 'failed');
  const pendingThisInnings = current ? pending.filter((q) => q.payload.inningsNumber === current.inningsNumber) : [];
  const legalBalls = (current?.legalBalls || 0) + pendingThisInnings.filter((q) => isLegal(q.payload.extraType)).length;

  const battingSide = current?.battingSide;
  const battingRoster = match && battingSide ? match[battingSide === 'A' ? 'teamA' : 'teamB'].players : [];
  const bowlingRoster = match && battingSide ? match[battingSide === 'A' ? 'teamB' : 'teamA'].players : [];

  // Dismissed batters can't be picked again (a retired-hurt batter may return)
  const dismissed: PlayerRef[] = [
    ...(current?.deliveries || [])
      .filter((d) => d.wicket && d.wicket.type !== 'retired hurt')
      .map((d) => ({ name: d.wicket!.playerOutName || '' })),
    ...pendingThisInnings
      .filter((q) => q.payload.wicket && q.payload.wicket.type !== 'retired hurt')
      .map((q) => q.payload.wicket!.playerOut)
  ];

  const updateCrease = (patch: Partial<Crease>) => setCrease(crease ? { ...crease, ...patch } : crease);

  const resetBallForm = () => {
    setRuns(0);
    setExtraType(null);
    setIsWicket(false);
    setWicketType('bowled');
    setOutEnd('striker');
    setFielder(null);
  };

  const handleStart = async () => {
    setBusy(true);
    try {
      await api.post(`/matches/${id}/start`, { tossWinner, decision });
      await fetchMatch();
    } catch (err) {
      alert(errorMessage(err, 'Failed to start match'));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitDelivery = async () => {
    if (!current || !crease?.striker || !crease.nonStriker || !crease.bowler) return;
    const outPlayer = outEnd === 'striker' ? crease.striker : crease.nonStriker;

    const payload: DeliveryPayload = {
      clientEntryId: uuidv4(),
      inningsNumber: current.inningsNumber,
      batsman: crease.striker,
      nonStriker: crease.nonStriker,
      bowler: crease.bowler,
      runs,
      extraType,
      wicket: isWicket
        ? { type: wicketType, playerOut: outPlayer, ...(fielder && FIELDER_WICKETS.includes(wicketType) ? { fielder } : {}) }
        : null
    };

    // Batters change ends on odd runs; a legal sixth ball ends the over
    let striker: PlayerRef | null = crease.striker;
    let nonStriker: PlayerRef | null = crease.nonStriker;
    if (runs % 2 === 1) [striker, nonStriker] = [nonStriker, striker];
    if (isWicket) {
      if (sameName(striker, outPlayer)) striker = null;
      else nonStriker = null;
    }
    let bowler: PlayerRef | null = crease.bowler;
    let lastOverBowler = crease.lastOverBowler;
    if (isLegal(extraType) && (legalBalls + 1) % 6 === 0) {
      [striker, nonStriker] = [nonStriker, striker];
      lastOverBowler = crease.bowler.name;
      bowler = null;
    }

    setHistory((h) => [...h.slice(-20), crease]);
    setCrease({ ...crease, striker, nonStriker, bowler, lastOverBowler });
    resetBallForm();

    await db.deliveriesQueue.add({ matchId: id, payload, timestamp: Date.now(), status: 'pending' });
    await refreshQueue();
    if (navigator.onLine) await sync();
  };

  const handleUndo = async () => {
    if (!confirm('Undo the last ball?')) return;
    setBusy(true);
    try {
      const lastQueued = pending.at(-1);
      if (lastQueued) {
        await db.deliveriesQueue.delete(lastQueued.id!); // not sent yet: just drop it
        await refreshQueue();
      } else {
        await api.delete(`/matches/${id}/deliveries/last`);
        await fetchMatch();
      }
      const previous = history.at(-1);
      if (previous) {
        setCrease(previous);
        setHistory((h) => h.slice(0, -1));
      } else {
        setNotice('Ball removed. Check the batters and bowler are correct.');
      }
    } catch (err) {
      alert(errorMessage(err, 'Failed to undo'));
    } finally {
      setBusy(false);
    }
  };

  const handleEndInnings = async () => {
    if (pending.length) return alert('Wait for queued balls to sync first.');
    if (!confirm('End this innings now (declaration or all out)?')) return;
    try {
      await api.post(`/matches/${id}/innings/end`);
      await fetchMatch();
    } catch (err) {
      alert(errorMessage(err, 'Failed to end innings'));
    }
  };

  const handleAbandon = async () => {
    if (pending.length) return alert('Wait for queued balls to sync first.');
    if (!confirm('Abandon this match with no result? Stats will be finalised.')) return;
    try {
      await api.post(`/matches/${id}/complete`, { result: 'No result (abandoned)' });
      await fetchMatch();
    } catch (err) {
      alert(errorMessage(err, 'Failed to abandon match'));
    }
  };

  const discardFailed = async (item: QueuedDelivery) => {
    await db.deliveriesQueue.delete(item.id!);
    await refreshQueue();
  };

  const copyLiveLink = async () => {
    if (!match) return;
    await navigator.clipboard.writeText(`${window.location.origin}/live/${match.publicSlug}`);
    setNotice('Live scoreboard link copied.');
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Activity className="animate-spin text-primary w-10 h-10" /></div>;
  if (error || !match) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 space-y-4">
        <div className="bg-red-500/20 p-4 text-red-400 rounded-xl">{error || 'Match not found'}</div>
        <Link href="/login" className="text-primary hover:underline">Sign in</Link>
      </div>
    );
  }

  const canSubmit = Boolean(crease?.striker && crease.nonStriker && crease.bowler) && !busy;
  const overBalls = (current?.deliveries || []).filter((d) => d.over === Math.floor((current?.legalBalls || 0) / 6));

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
          <button onClick={copyLiveLink} className="text-slate-400 hover:text-white" title="Copy live link">
            <Link2 className="w-5 h-5" />
          </button>
        </div>

        {current && (
          <div className="bg-slate-900 rounded-xl p-4 text-center border border-slate-700 shadow-inner">
            <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">{current.battingTeam} batting · Innings {current.inningsNumber}</div>
            <div className="text-5xl font-black text-primary mb-1">
              {current.totalRuns} <span className="text-slate-500 text-3xl font-medium">/</span> {current.totalWickets}
            </div>
            <div className="text-slate-400 font-semibold tracking-widest text-sm uppercase">
              Overs: <span className="text-white">{formatOvers(legalBalls)}</span> / {match.oversLimit}
            </div>
            {current.target && (
              <div className="text-sm text-yellow-400 mt-1">
                Need {Math.max(0, current.target - current.totalRuns)} from {Math.max(0, match.oversLimit * 6 - legalBalls)} balls
              </div>
            )}
          </div>
        )}
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-6">
        {!online && (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 p-3 rounded-xl text-sm">
            <CloudOff className="w-4 h-4 shrink-0" /> Offline — balls are saved on this device and will sync automatically.
          </div>
        )}
        {pending.length > 0 && (
          <div className="text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded-xl p-3">
            {pending.length} ball{pending.length === 1 ? '' : 's'} waiting to sync; the score above updates once they arrive.
          </div>
        )}
        {failed.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">
            <span>Ball not recorded: {item.error}</span>
            <button onClick={() => discardFailed(item)} className="underline shrink-0">Discard</button>
          </div>
        ))}
        {notice && (
          <div className="bg-slate-800 border border-slate-700 p-3 rounded-xl text-sm text-slate-300 flex justify-between gap-3">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} className="text-slate-500">✕</button>
          </div>
        )}

        {match.status === 'upcoming' && (
          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 space-y-4">
            <h3 className="font-bold text-slate-300">Toss</h3>
            <div className="grid grid-cols-2 gap-3">
              {(['A', 'B'] as Side[]).map((side) => (
                <button key={side} onClick={() => setTossWinner(side)}
                  className={`py-3 rounded-xl font-bold ${tossWinner === side ? 'bg-primary text-white' : 'bg-slate-700 text-slate-300'}`}>
                  {side === 'A' ? match.teamA.name : match.teamB.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['bat', 'bowl'] as const).map((d) => (
                <button key={d} onClick={() => setDecision(d)}
                  className={`py-3 rounded-xl font-bold capitalize ${decision === d ? 'bg-accent text-white' : 'bg-slate-700 text-slate-300'}`}>
                  Chose to {d}
                </button>
              ))}
            </div>
            <button onClick={handleStart} disabled={busy} className="btn-primary w-full">Start Match</button>
          </div>
        )}

        {match.status === 'completed' && (
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
            <h2 className="text-xl font-bold">{match.result}</h2>
            {inningsList.map((inn) => (
              <p key={inn._id} className="text-slate-400">{inn.battingTeam}: {inn.totalRuns}/{inn.totalWickets} ({inn.totalOvers} ov)</p>
            ))}
            <Link href={`/live/${match.publicSlug}`} className="text-primary hover:underline block">View scorecard</Link>
          </div>
        )}

        {match.status === 'live' && current && crease && (
          <>
            {/* Active Players */}
            <div className="grid grid-cols-2 gap-4">
              <PlayerPicker label="Striker" roster={battingRoster} value={crease.striker}
                exclude={[crease.nonStriker, ...dismissed]} onChange={(p) => updateCrease({ striker: p })} />
              <PlayerPicker label="Non-striker" roster={battingRoster} value={crease.nonStriker}
                exclude={[crease.striker, ...dismissed]} onChange={(p) => updateCrease({ nonStriker: p })} />
            </div>
            <PlayerPicker
              label={crease.lastOverBowler ? `Bowler (not ${crease.lastOverBowler})` : 'Bowler'}
              roster={bowlingRoster}
              value={crease.bowler}
              exclude={[{ name: crease.lastOverBowler || '' }]}
              onChange={(p) => updateCrease({ bowler: p })}
            />
            {!canSubmit && !busy && (
              <p className="text-sm text-yellow-400">
                {!crease.bowler && crease.lastOverBowler ? 'Over complete — choose the next bowler. ' : ''}
                {!crease.striker || !crease.nonStriker ? 'Choose both batters to continue.' : ''}
              </p>
            )}

            {/* This over */}
            <div className="flex gap-2 flex-wrap">
              {overBalls.map((d) => (
                <span key={d._id} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${d.wicket ? 'bg-red-500/30 text-red-300' : d.extraType ? 'bg-yellow-500/20 text-yellow-300' : 'bg-slate-700'}`}>
                  {ballLabel(d)}
                </span>
              ))}
              {pendingThisInnings.map((q) => (
                <span key={q.id} className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border border-dashed border-slate-500 text-slate-400">
                  {ballLabel(q.payload)}
                </span>
              ))}
            </div>

            {/* Scoring Controls */}
            <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
              <h3 className="font-bold mb-4 text-slate-300">{extraType && extraType !== 'noball' ? 'Runs run' : 'Runs off bat'}</h3>
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[0, 1, 2, 3, 4, 5, 6].map(num => (
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
                {EXTRA_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setExtraType(extraType === type ? null : type)}
                    className={`py-2 rounded-lg font-bold text-sm transition-all ${extraType === type ? 'bg-yellow-500 text-white' : 'bg-slate-700 text-slate-400'}`}
                  >
                    {EXTRA_LABELS[type]}
                  </button>
                ))}
              </div>

              <h3 className="font-bold mb-3 text-red-400">Wicket?</h3>
              <button
                onClick={() => setIsWicket(!isWicket)}
                className={`w-full py-3 rounded-xl font-black text-lg transition-all ${isWicket ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-slate-700 text-red-400 border border-red-500/30'}`}
              >
                WICKET
              </button>
              {isWicket && (
                <div className="mt-4 space-y-3">
                  <select value={wicketType} onChange={e => setWicketType(e.target.value as WicketType)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm font-semibold focus:outline-none capitalize">
                    {WICKET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {(wicketType === 'run out' || wicketType === 'retired hurt') && (
                    <div className="grid grid-cols-2 gap-2">
                      {(['striker', 'nonStriker'] as const).map((end) => (
                        <button key={end} onClick={() => setOutEnd(end)}
                          className={`py-2 rounded-lg text-sm font-bold ${outEnd === end ? 'bg-red-500/30 text-red-200' : 'bg-slate-700 text-slate-400'}`}>
                          {(end === 'striker' ? crease.striker?.name : crease.nonStriker?.name) || end} out
                        </button>
                      ))}
                    </div>
                  )}
                  {FIELDER_WICKETS.includes(wicketType) && (
                    <PlayerPicker label="Fielder" roster={bowlingRoster} value={fielder} exclude={[]} onChange={setFielder} />
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleSubmitDelivery}
              disabled={!canSubmit}
              className="w-full bg-gradient-to-r from-primary to-emerald-400 text-white font-black text-xl py-5 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:scale-100"
            >
              <CheckCircle2 className="w-6 h-6" /> SUBMIT BALL
            </button>
            <button onClick={handleUndo} disabled={busy || (!pending.length && !current.deliveries?.length && current.inningsNumber === 1)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl border border-slate-700 flex justify-center items-center gap-2 disabled:opacity-40">
              <Undo2 className="w-5 h-5" /> Undo last ball
            </button>

            <div className="pt-8 border-t border-slate-800 grid grid-cols-2 gap-3">
              <button onClick={handleEndInnings} className="bg-slate-800 hover:bg-slate-700 text-yellow-400 font-bold py-4 rounded-xl border border-slate-700 flex justify-center items-center gap-2">
                <Flag className="w-5 h-5" /> End innings
              </button>
              <button onClick={handleAbandon} className="bg-slate-800 hover:bg-slate-700 text-red-400 font-bold py-4 rounded-xl border border-slate-700 flex justify-center items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Abandon
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
