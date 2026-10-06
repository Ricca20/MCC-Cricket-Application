"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Trophy, Users, Edit3, Settings, ShieldAlert, CheckCircle2, Plus, Save, X } from 'lucide-react';
import api from '@/lib/api';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'tournaments' | 'matches'>('tournaments');
  
  const [tournamentName, setTournamentName] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [activeTournament, setActiveTournament] = useState<any>(null);

  const [showTeamManager, setShowTeamManager] = useState(false);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [newTeamName, setNewTeamName] = useState('');

  // Match state
  const [matchForm, setMatchForm] = useState({
    matchType: 'friendly',
    teamA: '',
    teamB: '',
    oversLimit: 20
  });

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const res = await api.get('/tournaments');
      setTournaments(res.data);
      if (res.data.length > 0) setActiveTournament(res.data[0]);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await api.get('/teams');
      setAllTeams(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenTeamManager = () => {
    fetchTeams();
    if (activeTournament && activeTournament.teams) {
      setSelectedTeamIds(activeTournament.teams.map((t: any) => typeof t === 'string' ? t : t._id));
    } else {
      setSelectedTeamIds([]);
    }
    setShowTeamManager(true);
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('mcc_token');
      await api.post('/tournaments', { name: tournamentName, format: 'knockout', startDate: new Date() }, { headers: { Authorization: `Bearer ${token}` }});
      setSuccessMsg('Tournament created successfully!');
      setTournamentName('');
      fetchTournaments();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateNewTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName) return;
    try {
      const token = localStorage.getItem('mcc_token');
      await api.post('/teams', { name: newTeamName, captainId: null }, { headers: { Authorization: `Bearer ${token}` }});
      setNewTeamName('');
      fetchTeams(); // Refresh the list so the admin can select the new team
    } catch (err) {
      console.error(err);
      alert('Failed to create team.');
    }
  };

  const handleToggleTeamSelection = (teamId: string) => {
    if (selectedTeamIds.includes(teamId)) {
      setSelectedTeamIds(selectedTeamIds.filter(id => id !== teamId));
    } else {
      setSelectedTeamIds([...selectedTeamIds, teamId]);
    }
  };

  const handleSaveTournamentTeams = async () => {
    if (!activeTournament) return;
    try {
      const token = localStorage.getItem('mcc_token');
      await api.post(`/tournaments/${activeTournament._id}/teams`, { teamIds: selectedTeamIds }, { headers: { Authorization: `Bearer ${token}` }});
      setSuccessMsg('Teams updated for tournament!');
      fetchTournaments();
      setShowTeamManager(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save tournament teams.');
    }
  };

  const handleGenerateDraw = async () => {
    if (!activeTournament) return;
    try {
      const token = localStorage.getItem('mcc_token');
      await api.post(`/tournaments/${activeTournament._id}/generate-draw`, {}, { headers: { Authorization: `Bearer ${token}` }});
      setSuccessMsg('Draw generated successfully!');
      fetchTournaments();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to generate draw.');
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('mcc_token');
      const teamAData = allTeams.find(t => t._id === matchForm.teamA);
      const teamBData = allTeams.find(t => t._id === matchForm.teamB);
      
      if (!teamAData || !teamBData) return alert('Select both teams');
      
      const res = await api.post('/matches', {
        matchType: matchForm.matchType,
        date: new Date(),
        venue: 'Home Ground',
        oversLimit: matchForm.oversLimit,
        teamA: { teamId: teamAData._id, name: teamAData.name },
        teamB: { teamId: teamBData._id, name: teamBData.name },
        scorerId: JSON.parse(localStorage.getItem('mcc_user') || '{}').id
      }, { headers: { Authorization: `Bearer ${token}` }});
      
      setSuccessMsg('Match created! Redirecting to scoring...');
      setTimeout(() => {
        window.location.href = `/score/${res.data._id}`;
      }, 1500);
    } catch (err) {
      console.error(err);
      alert('Failed to create match');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20 relative">
      {/* Mobile-optimized Header */}
      <header className="glass-panel sticky top-0 z-40 rounded-none border-t-0 border-l-0 border-r-0 border-b border-white/10 px-4 py-4 flex flex-col gap-3">
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
            
            {showTeamManager ? (
              <div className="glass-panel p-6 border-primary/50 relative">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-bold text-lg text-primary flex items-center gap-2">
                    <Users className="w-5 h-5" /> Manage Teams
                  </h2>
                  <button onClick={() => setShowTeamManager(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="mb-6">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Create New Team</label>
                  <form onSubmit={handleCreateNewTeam} className="flex gap-2">
                    <input type="text" className="input-field flex-1 py-2 text-sm" placeholder="Team Name..." value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                    <button type="submit" className="bg-slate-700 hover:bg-slate-600 text-white px-4 rounded-xl text-sm font-bold flex items-center gap-1 transition-colors">
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </form>
                </div>

                <div className="mb-6">
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider ml-1">Select Teams for {activeTournament?.name}</label>
                  <div className="bg-slate-900/50 rounded-xl p-2 border border-slate-700 max-h-60 overflow-y-auto space-y-1">
                    {allTeams.length === 0 ? (
                      <p className="text-slate-500 text-sm p-4 text-center">No teams exist yet.</p>
                    ) : (
                      allTeams.map(team => (
                        <label key={team._id} className="flex items-center gap-3 p-3 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-700">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded text-primary focus:ring-primary bg-slate-900 border-slate-600"
                            checked={selectedTeamIds.includes(team._id)}
                            onChange={() => handleToggleTeamSelection(team._id)}
                          />
                          <span className="font-medium text-sm text-slate-200">{team.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 ml-1">{selectedTeamIds.length} teams selected</p>
                </div>

                <button onClick={handleSaveTournamentTeams} className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-bold">
                  <Save className="w-4 h-4" /> Save Tournament Teams
                </button>
              </div>
            ) : (
              <>
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
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-2 mt-8">Manage Active: {activeTournament?.name || 'None'}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={handleOpenTeamManager} disabled={!activeTournament} className={`glass-panel p-4 flex flex-col items-center justify-center gap-3 transition-colors ${!activeTournament ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 border border-transparent hover:border-slate-600 active:scale-95'}`}>
                    <Users className="w-6 h-6 text-accent" />
                    <span className="text-xs font-medium text-slate-300">Manage Teams</span>
                  </button>
                  <button onClick={handleGenerateDraw} disabled={!activeTournament} className={`glass-panel p-4 flex flex-col items-center justify-center gap-3 transition-colors ${!activeTournament ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 border border-transparent hover:border-slate-600 active:scale-95'}`}>
                    <Settings className="w-6 h-6 text-slate-400" />
                    <span className="text-xs font-medium text-slate-300">Generate Draw</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6 transition-all duration-300">
            {/* Create Match Card */}
            <div className="glass-panel p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30 text-accent">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Create Match</h2>
                  <p className="text-xs text-slate-400">Initialize a new scorable match</p>
                </div>
              </div>
              
              <form onSubmit={handleCreateMatch} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Match Type</label>
                  <select className="input-field w-full" value={matchForm.matchType} onChange={e => setMatchForm({...matchForm, matchType: e.target.value})}>
                    <option value="friendly">Friendly</option>
                    <option value="tournament">Tournament</option>
                    <option value="practice">Practice</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Team A</label>
                    <select className="input-field w-full" required value={matchForm.teamA} onChange={e => setMatchForm({...matchForm, teamA: e.target.value})} onFocus={fetchTeams}>
                      <option value="">Select Team</option>
                      {allTeams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Team B</label>
                    <select className="input-field w-full" required value={matchForm.teamB} onChange={e => setMatchForm({...matchForm, teamB: e.target.value})} onFocus={fetchTeams}>
                      <option value="">Select Team</option>
                      {allTeams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Overs Limit</label>
                  <input type="number" className="input-field w-full" required min="1" max="50" value={matchForm.oversLimit} onChange={e => setMatchForm({...matchForm, oversLimit: parseInt(e.target.value)})} />
                </div>

                <button type="submit" className="glass-panel w-full py-3.5 text-sm uppercase tracking-wider font-bold text-accent border border-accent/30 hover:bg-accent/10 transition-colors mt-4">
                  Create & Start Scoring
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
