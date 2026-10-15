"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, User, TrendingUp, Activity, Edit2, Save, X, Image as ImageIcon, Crosshair, Zap, Shield } from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api, { errorMessage } from '@/lib/api';
import { useStoredUser } from '@/lib/hooks';
import type { MatchHistoryItem, Player, PlayerStats } from '@/lib/types';

type EditForm = Pick<Player, 'name' | 'nickname' | 'profilePhoto' | 'battingStyle' | 'bowlingStyle'> & { jerseyNumber?: number | string };

const toEditForm = (p: Player): EditForm => ({
  name: p.name,
  nickname: p.nickname,
  profilePhoto: p.profilePhoto,
  battingStyle: p.battingStyle,
  bowlingStyle: p.bowlingStyle,
  jerseyNumber: p.jerseyNumber ?? ''
});

const roleLabel = (roles: string[]) =>
  roles.includes('admin') ? 'Club Admin' : roles.includes('scorer') ? 'Scorer' : 'Player';

export default function PlayerProfile() {
  const params = useParams();
  const id = params.id as string;

  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [trends, setTrends] = useState<{ matchDate: string; runs: number; wickets: number }[]>([]);
  const [error, setError] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ name: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Only decides whether to show the edit button; the API enforces it
  const user = useStoredUser();
  const isOwner = Boolean(user && (user.id === id || user.roles.includes('admin')));

  useEffect(() => {
    // The profile response is the single source of the stats shown
    api.get(`/players/${id}`).then(res => {
      setPlayer(res.data.player);
      setEditForm(toEditForm(res.data.player));
      setStats(res.data.stats);
      setMatchHistory(res.data.matchHistory || []);
    }).catch(() => {
      setError('Player not found or server error');
    });

    api.get(`/players/${id}/trends`).then(res => {
       setTrends(res.data.trends || []);
    }).catch(err => {
      console.error(err);
    });
  }, [id]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setError('');
    try {
      const res = await api.put(`/players/${id}`, {
        ...editForm,
        nickname: editForm.nickname || '',
        profilePhoto: editForm.profilePhoto || '',
        jerseyNumber: editForm.jerseyNumber === '' ? '' : Number(editForm.jerseyNumber)
      });
      setPlayer(res.data);
      setIsEditing(false);
    } catch (err) {
      alert(errorMessage(err, 'Failed to update profile'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Please choose an image under 5 MB.');
      return;
    }

    setIsUploading(true);
    try {
      // The server signs the upload, so no Cloudinary credentials live in the browser
      const { data: sig } = await api.post('/uploads/signature');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', sig.apiKey);
      formData.append('timestamp', String(sig.timestamp));
      formData.append('signature', sig.signature);
      formData.append('folder', sig.folder);
      formData.append('allowed_formats', sig.allowed_formats);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (data.secure_url) {
        setEditForm({ ...editForm, profilePhoto: data.secure_url });
      } else {
        alert(data.error?.message || 'Failed to upload image.');
      }
    } catch (err) {
      alert(errorMessage(err, 'An error occurred while uploading the image.'));
    } finally {
      setIsUploading(false);
    }
  };

  if (error) {
    return <div className="min-h-screen bg-[#0B1120] flex items-center justify-center text-white p-6"><div className="bg-red-500/20 border border-red-500/30 text-red-400 p-6 rounded-2xl max-w-md text-center">{error}</div></div>;
  }

  if (!player || !stats) {
    return <div className="min-h-screen bg-[#0B1120] flex items-center justify-center text-white"><Activity className="animate-spin w-10 h-10 text-primary"/></div>;
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-white pb-20 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-accent/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 space-y-8 relative z-10">
        
        {/* Navigation */}
        <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white transition-colors group">
          <div className="bg-slate-800/80 p-2.5 rounded-full mr-3 group-hover:bg-slate-700 transition-colors border border-slate-700/50">
            <ChevronLeft className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm uppercase tracking-wider">Back to Dashboard</span>
        </Link>

        {/* Profile Card */}
        <div className="glass-panel overflow-hidden border-0 shadow-2xl bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10">
          
          {/* Cover Banner */}
          <div className="h-32 sm:h-48 w-full bg-gradient-to-r from-emerald-600/40 via-slate-800 to-blue-600/40 relative">
            <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-slate-900/90 to-transparent" />
            
            {/* Action Buttons */}
            {isOwner && !isEditing && (
               <div className="absolute top-4 right-4 z-20">
                 <button onClick={() => setIsEditing(true)} className="bg-black/40 hover:bg-black/60 backdrop-blur-md text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 border border-white/20 transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95">
                   <Edit2 className="w-4 h-4" /> Edit Profile
                 </button>
               </div>
            )}
          </div>

          <div className="px-6 sm:px-10 pb-8 relative -mt-16 sm:-mt-20">
            {isEditing ? (
              <div className="bg-slate-800/80 backdrop-blur-md p-6 sm:p-8 rounded-2xl border border-slate-700 shadow-xl mt-16 sm:mt-20">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
                  <h3 className="font-extrabold text-2xl">Edit Profile</h3>
                  <button onClick={() => setIsEditing(false)} className="bg-slate-700 hover:bg-slate-600 p-2 rounded-full text-slate-300 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-8 mb-8">
                  {/* Editable Avatar */}
                  <div className="flex flex-col items-center shrink-0">
                    <label className={`w-32 h-32 sm:w-40 sm:h-40 bg-slate-800 rounded-full border-4 border-slate-600 shadow-xl shrink-0 relative group ${isUploading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-primary transition-colors'}`}>
                       <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
                         {editForm.profilePhoto ? (
                           <img src={editForm.profilePhoto} alt={player.name} className="w-full h-full object-cover" />
                         ) : (
                           <User className="w-16 h-16 text-slate-500" />
                         )}
                       </div>
                       
                       <div className="absolute bottom-0 right-2 bg-primary text-white p-2.5 rounded-full shadow-lg border-4 border-slate-800 group-hover:scale-110 group-hover:bg-primary-dark transition-all">
                         {isUploading ? <Activity className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                       </div>
                       
                       <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                    </label>
                    <p className="text-xs font-medium text-slate-400 mt-4 text-center w-32">Click image to upload (JPG, PNG or WebP)</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1">
                    <div className="md:col-span-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Full Name</label>
                      <input type="text" className="input-field" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Nickname</label>
                      <input type="text" className="input-field" value={editForm.nickname || ''} onChange={e => setEditForm({...editForm, nickname: e.target.value})} placeholder="e.g. The Finisher" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Jersey Number (1-999)</label>
                      <input type="number" min="1" max="999" className="input-field" value={editForm.jerseyNumber || ''} onChange={e => setEditForm({...editForm, jerseyNumber: e.target.value})} placeholder="e.g. 10" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Batting Style</label>
                      <select className="input-field" value={editForm.battingStyle || ''} onChange={e => setEditForm({...editForm, battingStyle: e.target.value})}>
                        <option value="">Select Style</option>
                        <option value="Right-hand bat">Right-hand bat</option>
                        <option value="Left-hand bat">Left-hand bat</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Bowling Style</label>
                      <select className="input-field" value={editForm.bowlingStyle || ''} onChange={e => setEditForm({...editForm, bowlingStyle: e.target.value})}>
                        <option value="None">None</option>
                        <option value="Right-arm Fast">Right-arm Fast</option>
                        <option value="Right-arm Medium">Right-arm Medium</option>
                        <option value="Right-arm Off Spin">Right-arm Off Spin</option>
                        <option value="Right-arm Leg Spin">Right-arm Leg Spin</option>
                        <option value="Left-arm Fast">Left-arm Fast</option>
                        <option value="Left-arm Medium">Left-arm Medium</option>
                        <option value="Left-arm Orthodox">Left-arm Orthodox</option>
                        <option value="Left-arm Chinaman">Left-arm Chinaman</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end pt-4 border-t border-slate-700 mt-2">
                  <button onClick={handleSaveProfile} disabled={isSaving} className="btn-primary flex items-center gap-2">
                    {isSaving ? <Activity className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center sm:items-end">
                {/* Avatar Display */}
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-slate-800 border-4 border-slate-900 shadow-2xl relative shrink-0 z-10 flex items-center justify-center overflow-hidden">
                   {player.profilePhoto ? (
                     <img src={player.profilePhoto} alt={player.name} className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                       <User className="w-16 h-16 text-slate-400" />
                     </div>
                   )}
                </div>

                {/* Info Display */}
                <div className="flex-1 text-center sm:text-left pt-2 sm:pt-0 w-full">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 mb-1">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300 drop-shadow-sm">
                      {player.name}
                    </h1>
                    {player.jerseyNumber !== undefined && player.jerseyNumber !== null && (
                      <span className="text-2xl sm:text-3xl font-black italic text-primary drop-shadow-md">#{player.jerseyNumber}</span>
                    )}
                  </div>
                  
                  {player.nickname && <p className="text-accent font-semibold mb-4 text-lg">&ldquo;{player.nickname}&rdquo;</p>}
                  {!player.nickname && <div className="h-4"></div>}
                  
                  <div className="flex flex-wrap gap-2.5 justify-center sm:justify-start mt-2">
                    <div className="px-4 py-1.5 bg-slate-800/80 border border-slate-700 rounded-full text-sm font-semibold shadow-sm flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-slate-400" />
                      {roleLabel(player.roles || [])}
                    </div>
                    {player.battingStyle && (
                      <div className="px-4 py-1.5 bg-primary/10 border border-primary/20 text-primary-dark rounded-full text-sm font-semibold shadow-sm flex items-center gap-1.5">
                        <Crosshair className="w-4 h-4" />
                        {player.battingStyle}
                      </div>
                    )}
                    {player.bowlingStyle && player.bowlingStyle !== 'None' && (
                      <div className="px-4 py-1.5 bg-accent/10 border border-accent/20 text-blue-400 rounded-full text-sm font-semibold shadow-sm flex items-center gap-1.5">
                        <Zap className="w-4 h-4" />
                        {player.bowlingStyle}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Career Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="glass-panel p-6 relative overflow-hidden group hover:border-white/20 transition-all border-b-4 border-b-blue-500 bg-slate-900/40">
             <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-300">
               <Activity className="w-24 h-24 text-blue-500" />
             </div>
             <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 relative z-10">Matches</div>
             <div className="text-4xl sm:text-5xl font-black text-white relative z-10">{stats.matchesPlayed}</div>
          </div>
          
          <div className="glass-panel p-6 relative overflow-hidden group hover:border-white/20 transition-all border-b-4 border-b-primary bg-slate-900/40">
             <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-300">
               <TrendingUp className="w-24 h-24 text-primary" />
             </div>
             <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 relative z-10">Total Runs</div>
             <div className="text-4xl sm:text-5xl font-black text-primary relative z-10">{stats.runs}</div>
          </div>
          
          <div className="glass-panel p-6 relative overflow-hidden group hover:border-white/20 transition-all border-b-4 border-b-accent bg-slate-900/40">
             <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-300">
               <User className="w-24 h-24 text-accent" />
             </div>
             <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 relative z-10">Wickets</div>
             <div className="text-4xl sm:text-5xl font-black text-accent relative z-10">{stats.wickets}</div>
          </div>
          
          <div className="glass-panel p-6 relative overflow-hidden group hover:border-white/20 transition-all border-b-4 border-b-purple-500 bg-slate-900/40">
             <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-300">
               <Zap className="w-24 h-24 text-purple-500" />
             </div>
             <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 relative z-10">Strike Rate</div>
             <div className="text-4xl sm:text-5xl font-black text-white relative z-10">
               {stats.strikeRate.toFixed(1)}
             </div>
          </div>
        </div>

        {/* Detailed career figures */}
        <div className="glass-panel p-6 bg-slate-900/40 grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 text-sm">
          {[
            ['Batting avg', stats.battingAverage === null ? '-' : stats.battingAverage.toFixed(2)],
            ['High score', stats.highScore],
            ['50s / 100s', `${stats.fifties} / ${stats.hundreds}`],
            ['Not outs', stats.notOuts],
            ['Overs', stats.oversBowled],
            ['Economy', stats.economy.toFixed(2)],
            ['Best bowling', stats.bestBowling],
            ['Ct / RO / St', `${stats.catches} / ${stats.runOuts} / ${stats.stumpings}`]
          ].map(([label, value]) => (
            <div key={label as string}>
              <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">{label}</div>
              <div className="text-xl font-bold text-white">{value}</div>
            </div>
          ))}
        </div>

        {/* Form Guide / Trends Chart */}
        <div className="glass-panel p-6 sm:p-8 bg-slate-900/40">
          <h2 className="text-xl sm:text-2xl font-black mb-8 flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-lg text-primary">
              <TrendingUp className="w-6 h-6" /> 
            </div>
            Form Guide
          </h2>
          
          {trends.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="matchDate" stroke="#94a3b8" tick={{fontSize: 12, fontWeight: 500}} tickMargin={10} />
                  <YAxis yAxisId="left" stroke="#10b981" tick={{fontSize: 12, fontWeight: 500}} />
                  <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" tick={{fontSize: 12, fontWeight: 500}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                    itemStyle={{ color: '#fff', fontWeight: 600 }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="runs" name="Runs" stroke="#10b981" strokeWidth={4} dot={{ r: 5, fill: '#0f172a', strokeWidth: 2 }} activeDot={{ r: 8, fill: '#10b981', strokeWidth: 0 }} />
                  <Line yAxisId="right" type="monotone" dataKey="wickets" name="Wickets" stroke="#3b82f6" strokeWidth={4} dot={{ r: 5, fill: '#0f172a', strokeWidth: 2 }} activeDot={{ r: 8, fill: '#3b82f6', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
             <div className="py-20 text-center flex flex-col items-center justify-center bg-slate-800/30 rounded-2xl border border-slate-700/50 border-dashed">
               <Activity className="w-16 h-16 text-slate-600 mb-4" />
               <h3 className="text-xl font-bold text-slate-400 mb-2">No Match Data Yet</h3>
               <p className="text-slate-500 max-w-md">Once you play matches and get scored, your performance trends and form guide will automatically populate here.</p>
             </div>
          )}
        </div>

        {/* Match History */}
        {matchHistory.length > 0 && (
          <div className="glass-panel p-6 sm:p-8 bg-slate-900/40">
            <h2 className="text-xl sm:text-2xl font-black mb-6">Match History</h2>
            <div className="space-y-3">
              {matchHistory.map((m) => {
                const row = (
                  <>
                    <div>
                      <p className="font-semibold text-white">{m.title}</p>
                      <p className="text-xs text-slate-400">{m.matchDate}{m.result ? ` · ${m.result}` : ''}</p>
                    </div>
                    <div className="text-right text-sm">
                      {m.batting && <p className="text-primary">{m.batting.runs}{m.batting.out ? '' : '*'} ({m.batting.balls})</p>}
                      {m.bowling && <p className="text-accent">{m.bowling.wickets}/{m.bowling.runsConceded}</p>}
                    </div>
                  </>
                );
                const className = "flex justify-between items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-white/5";
                return m.publicSlug ? (
                  <Link key={m.matchId} href={`/live/${m.publicSlug}`} className={`${className} hover:bg-slate-800`}>{row}</Link>
                ) : (
                  <div key={m.matchId} className={className}>{row}</div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
