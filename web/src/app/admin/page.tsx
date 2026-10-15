"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Trophy, Users, Edit3, Settings, ShieldAlert, CheckCircle2, Plus, Save, X, Link2, Play, ExternalLink, GitBranch } from 'lucide-react';
import api, { errorMessage } from '@/lib/api';
import { useStoredUser } from '@/lib/hooks';
import type { Fixture, Match, Player, Team, Tournament } from '@/lib/types';

type Tab = 'tournaments' | 'matches' | 'players';

const FORMATS: { value: Tournament['format']; label: string }[] = [
  { value: 'knockout', label: 'Knockout' },
  { value: 'round-robin', label: 'Round robin' },
  { value: 'groups-knockout', label: 'Groups then knockout' }
];

const label = "block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider ml-1";

export default function AdminDashboard() {
  const router = useRouter();
  const user = useStoredUser();
  const isAdmin = Boolean(user?.roles.includes('admin'));

  const [activeTab, setActiveTab] = useState<Tab>('matches');
  const [successMsg, setSuccessMsg] = useState('');

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournamentId, setActiveTournamentId] = useState('');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [tournamentForm, setTournamentForm] = useState<{ name: string; format: Tournament['format'] }>({ name: '', format: 'knockout' });
  const [groupCount, setGroupCount] = useState('');

  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showTeamManager, setShowTeamManager] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [newTeam, setNewTeam] = useState({ name: '', isClubTeam: false, memberIds: [] as string[], guestNames: '' });

  const [matches, setMatches] = useState<Match[]>([]);
  const [matchForm, setMatchForm] = useState({
    matchType: 'friendly' as Match['matchType'],
    teamA: '',
    teamB: '',
    fixtureId: '',
    oversLimit: 20,
    venue: 'Home Ground',
    scorerId: '',
    isPublic: true
  });

  const activeTournament = tournaments.find((t) => t._id === activeTournamentId) || null;
  const scorers = players.filter((p) => p.roles.some((r) => r === 'scorer' || r === 'admin'));
  const openFixtures = fixtures.filter((f) => !f.matchId && !f.isBye && f.teamA && f.teamB);

  const flash = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const fetchTournaments = useCallback(() =>
    api.get<Tournament[]>('/tournaments').then((res) => {
      setTournaments(res.data);
      setActiveTournamentId((current) => current || res.data[0]?._id || '');
    }), []);

  const fetchTeams = useCallback(() => api.get<Team[]>('/teams').then((res) => setAllTeams(res.data)), []);

  const fetchPlayers = useCallback(() => api.get<Player[]>('/players').then((res) => setPlayers(res.data)), []);

  const fetchMatches = useCallback(() => api.get<Match[]>('/matches').then((res) => setMatches(res.data)), []);

  const roles = user?.roles || [];
  const canManage = roles.includes('admin') || roles.includes('scorer');
  const loadAdminData = roles.includes('admin');
  useEffect(() => {
    if (!canManage) return;

    fetchMatches().catch((err) => {
      if (err.response?.status === 401) router.push('/login');
    });
    if (loadAdminData) {
      Promise.all([fetchTournaments(), fetchTeams(), fetchPlayers()]).catch((err) => console.error(err));
    }
  }, [canManage, loadAdminData, fetchMatches, fetchTournaments, fetchTeams, fetchPlayers, router]);

  useEffect(() => {
    if (!activeTournamentId) return;
    api.get<Fixture[]>(`/tournaments/${activeTournamentId}/fixtures`).then((res) => setFixtures(res.data)).catch(() => setFixtures([]));
  }, [activeTournamentId, tournaments]);

  const handleOpenTeamManager = () => {
    setSelectedTeamIds((activeTournament?.teams || []).map((t) => (typeof t === 'string' ? t : t._id)));
    setShowTeamManager(true);
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post<Tournament>('/tournaments', { ...tournamentForm, startDate: new Date() });
      setTournamentForm({ name: '', format: 'knockout' });
      setActiveTournamentId(res.data._id);
      await fetchTournaments();
      flash('Tournament created successfully!');
    } catch (err) {
      alert(errorMessage(err, 'Failed to create tournament.'));
    }
  };

  const handleCreateNewTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeam.name.trim()) return;
    const members = players
      .filter((p) => newTeam.memberIds.includes(p._id))
      .map((p) => ({ name: p.name, userId: p._id }));
    const guests = newTeam.guestNames.split('\n').map((n) => n.trim()).filter(Boolean).map((name) => ({ name }));
    try {
      await api.post('/teams', { name: newTeam.name, isClubTeam: newTeam.isClubTeam, players: [...members, ...guests] });
      setNewTeam({ name: '', isClubTeam: false, memberIds: [], guestNames: '' });
      await fetchTeams();
      flash('Team created.');
    } catch (err) {
      alert(errorMessage(err, 'Failed to create team.'));
    }
  };

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const handleSaveTournamentTeams = async () => {
    if (!activeTournament) return;
    try {
      await api.put(`/tournaments/${activeTournament._id}/teams`, { teamIds: selectedTeamIds });
      await fetchTournaments();
      setShowTeamManager(false);
      flash('Teams updated for tournament!');
    } catch (err) {
      alert(errorMessage(err, 'Failed to save tournament teams.'));
    }
  };

  const handleGenerateDraw = async () => {
    if (!activeTournament) return;
    if (activeTournament.status !== 'draft' && !confirm('Regenerate the draw? The current fixtures will be replaced.')) return;
    try {
      const body = activeTournament.format === 'groups-knockout' && groupCount ? { groupCount: Number(groupCount) } : {};
      const res = await api.post(`/tournaments/${activeTournament._id}/generate-draw`, body);
      await fetchTournaments();
      flash(`Draw generated: ${res.data.fixturesCount} fixtures.`);
    } catch (err) {
      alert(errorMessage(err, 'Failed to generate draw.'));
    }
  };

  const handleGenerateKnockout = async () => {
    if (!activeTournament) return;
    try {
      await api.post(`/tournaments/${activeTournament._id}/generate-knockout`);
      await fetchTournaments();
      flash('Knockout stage generated.');
    } catch (err) {
      alert(errorMessage(err, 'Failed to generate the knockout stage.'));
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const fromFixture = matchForm.matchType === 'tournament';
    if (fromFixture && !matchForm.fixtureId) return alert('Choose a fixture');
    if (!fromFixture && (!matchForm.teamA || !matchForm.teamB || matchForm.teamA === matchForm.teamB)) return alert('Select two different teams');

    try {
      const res = await api.post<Match>('/matches', {
        matchType: matchForm.matchType,
        date: new Date(),
        venue: matchForm.venue,
        oversLimit: matchForm.oversLimit,
        ...(fromFixture ? { fixtureId: matchForm.fixtureId } : { teamA: matchForm.teamA, teamB: matchForm.teamB }),
        scorerId: matchForm.scorerId || user?.id,
        isPublic: matchForm.isPublic
      });
      await fetchMatches();
      if (fromFixture) await fetchTournaments();
      if (!matchForm.scorerId || matchForm.scorerId === user?.id) {
        router.push(`/score/${res.data._id}`);
      } else {
        flash('Match created and assigned.');
      }
    } catch (err) {
      alert(errorMessage(err, 'Failed to create match'));
    }
  };

  const handleRole = async (player: Player, role: string, action: 'grant' | 'revoke') => {
    try {
      await api.patch(`/players/${player._id}/role`, { role, action });
      await fetchPlayers();
    } catch (err) {
      alert(errorMessage(err, 'Failed to update role'));
    }
  };

  const copyLink = async (path: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    flash('Link copied.');
  };

  if (user === undefined) return null;
  if (!user || !user.roles.some((r) => r === 'admin' || r === 'scorer')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-6">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <p className="text-slate-300">This area is for club admins and scorers.</p>
        <Link href={user ? '/' : '/login'} className="text-primary hover:underline">{user ? 'Back to dashboard' : 'Sign in'}</Link>
      </div>
    );
  }

  const tabs: Tab[] = isAdmin ? ['matches', 'tournaments', 'players'] : ['matches'];

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20 relative">
      {/* Mobile-optimized Header */}
      <header className="glass-panel sticky top-0 z-40 rounded-none border-t-0 border-l-0 border-r-0 border-b border-white/10 px-4 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between w-full">
          <Link href="/" className="flex items-center text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6 mr-1" />
          </Link>
          <div className="font-bold text-lg tracking-wide flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" /> {isAdmin ? 'Admin Panel' : 'Scorer Panel'}
          </div>
          <div className="w-6 h-6"></div> {/* Spacer for centering */}
        </div>

        {tabs.length > 1 && (
          <div className="flex w-full bg-slate-800/50 p-1 rounded-xl">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all capitalize ${activeTab === tab ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="p-4 sm:p-6 max-w-lg mx-auto space-y-6 mt-4">
        {successMsg && (
          <div className="glass-panel bg-green-500/10 border-green-500/30 text-green-400 p-4 rounded-xl flex items-center gap-3 transition-opacity duration-300">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{successMsg}</p>
          </div>
        )}

        {activeTab === 'matches' && (
          <div className="space-y-6">
            {isAdmin && (
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
                    <label className={label}>Match Type</label>
                    <select className="input-field w-full" value={matchForm.matchType} onChange={e => setMatchForm({ ...matchForm, matchType: e.target.value as Match['matchType'] })}>
                      <option value="friendly">Friendly</option>
                      <option value="tournament">Tournament fixture</option>
                      <option value="practice">Practice</option>
                    </select>
                  </div>

                  {matchForm.matchType === 'tournament' ? (
                    <div className="space-y-4">
                      <div>
                        <label className={label}>Tournament</label>
                        <select className="input-field w-full" value={activeTournamentId} onChange={e => { setActiveTournamentId(e.target.value); setMatchForm({ ...matchForm, fixtureId: '' }); }}>
                          {tournaments.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={label}>Fixture</label>
                        <select className="input-field w-full" required value={matchForm.fixtureId} onChange={e => setMatchForm({ ...matchForm, fixtureId: e.target.value })}>
                          <option value="">Select fixture</option>
                          {openFixtures.map((f) => <option key={f._id} value={f._id}>{f.round}: {f.teamA?.name} vs {f.teamB?.name}</option>)}
                        </select>
                        {openFixtures.length === 0 && <p className="text-xs text-slate-500 mt-2 ml-1">No fixtures are ready to play. Generate the draw first.</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {(['teamA', 'teamB'] as const).map((side) => (
                        <div key={side}>
                          <label className={label}>{side === 'teamA' ? 'Team A' : 'Team B'}</label>
                          <select className="input-field w-full" required value={matchForm[side]} onChange={e => setMatchForm({ ...matchForm, [side]: e.target.value })}>
                            <option value="">Select Team</option>
                            {allTeams.map(t => <option key={t._id} value={t._id}>{t.name} ({t.players.length})</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={label}>Overs Limit</label>
                      <input type="number" className="input-field w-full" required min="1" max="50" value={matchForm.oversLimit} onChange={e => setMatchForm({ ...matchForm, oversLimit: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className={label}>Venue</label>
                      <input type="text" className="input-field w-full" value={matchForm.venue} onChange={e => setMatchForm({ ...matchForm, venue: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <label className={label}>Scorer</label>
                    <select className="input-field w-full" value={matchForm.scorerId} onChange={e => setMatchForm({ ...matchForm, scorerId: e.target.value })}>
                      <option value="">Me</option>
                      {scorers.filter((p) => p._id !== user.id).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </div>

                  <label className="flex items-center gap-3 text-sm text-slate-300 ml-1">
                    <input type="checkbox" checked={matchForm.isPublic} onChange={e => setMatchForm({ ...matchForm, isPublic: e.target.checked })} />
                    Public live scoreboard
                  </label>

                  <button type="submit" className="glass-panel w-full py-3.5 text-sm uppercase tracking-wider font-bold text-accent border border-accent/30 hover:bg-accent/10 transition-colors mt-4">
                    Create Match
                  </button>
                </form>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-2">{isAdmin ? 'Recent matches' : 'Your matches'}</h3>
              {matches.length === 0 && <p className="text-sm text-slate-500 pl-2">No matches yet.</p>}
              {matches.map((m) => (
                <div key={m._id} className="glass-panel p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{m.teamA.name} vs {m.teamB.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{m.status}{m.result ? ` · ${m.result}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {m.isPublic && (
                      <button onClick={() => copyLink(`/live/${m.publicSlug}`)} title="Copy live link" className="text-slate-400 hover:text-white"><Link2 className="w-5 h-5" /></button>
                    )}
                    <Link href={`/score/${m._id}`} className="text-primary hover:text-white" title={m.status === 'completed' ? 'View' : 'Score'}>
                      <Play className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tournaments' && isAdmin && (
          <div className="space-y-6 transition-all duration-300">
            {showTeamManager ? (
              <div className="glass-panel p-6 border-primary/50 relative">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-bold text-lg text-primary flex items-center gap-2">
                    <Users className="w-5 h-5" /> Manage Teams
                  </h2>
                  <button onClick={() => setShowTeamManager(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleCreateNewTeam} className="mb-6 space-y-3">
                  <label className={label}>Create New Team</label>
                  <input type="text" className="input-field py-2 text-sm" placeholder="Team Name..." value={newTeam.name} onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })} />
                  <label className="flex items-center gap-2 text-sm text-slate-300 ml-1">
                    <input type="checkbox" checked={newTeam.isClubTeam} onChange={(e) => setNewTeam({ ...newTeam, isClubTeam: e.target.checked })} /> Club team
                  </label>
                  {newTeam.isClubTeam && (
                    <div className="bg-slate-900/50 rounded-xl p-2 border border-slate-700 max-h-48 overflow-y-auto">
                      {players.map((p) => (
                        <label key={p._id} className="flex items-center gap-3 p-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={newTeam.memberIds.includes(p._id)} onChange={() => setNewTeam({ ...newTeam, memberIds: toggle(newTeam.memberIds, p._id) })} />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  )}
                  <textarea className="input-field text-sm" rows={3} placeholder={newTeam.isClubTeam ? 'Other players without accounts, one per line' : 'Players, one per line (optional)'} value={newTeam.guestNames} onChange={(e) => setNewTeam({ ...newTeam, guestNames: e.target.value })} />
                  <button type="submit" className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 transition-colors">
                    <Plus className="w-4 h-4" /> Add team
                  </button>
                </form>

                <div className="mb-6">
                  <label className={label}>Select Teams for {activeTournament?.name}</label>
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
                            onChange={() => setSelectedTeamIds(toggle(selectedTeamIds, team._id))}
                          />
                          <span className="font-medium text-sm text-slate-200">{team.name}</span>
                          <span className="text-xs text-slate-500 ml-auto">{team.players.length} players</span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 ml-1">{selectedTeamIds.length} teams selected</p>
                </div>

                <button onClick={handleSaveTournamentTeams} disabled={activeTournament?.status !== 'draft'} className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-50">
                  <Save className="w-4 h-4" /> Save Tournament Teams
                </button>
                {activeTournament?.status !== 'draft' && <p className="text-xs text-slate-500 mt-2 text-center">Teams are locked once the draw is published.</p>}
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
                      <label className={label}>Tournament Name</label>
                      <input
                        type="text"
                        value={tournamentForm.name}
                        onChange={(e) => setTournamentForm({ ...tournamentForm, name: e.target.value })}
                        className="input-field w-full text-base py-3"
                        placeholder="e.g. Summer Cup 2026"
                        required
                      />
                    </div>
                    <div>
                      <label className={label}>Format</label>
                      <select className="input-field w-full" value={tournamentForm.format} onChange={(e) => setTournamentForm({ ...tournamentForm, format: e.target.value as Tournament['format'] })}>
                        {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <button type="submit" className="btn-primary w-full py-3.5 text-sm uppercase tracking-wider font-bold">
                      Create Tournament
                    </button>
                  </form>
                </div>

                {/* Quick Actions Grid */}
                <div className="space-y-3 mt-8">
                  <label className={label}>Manage tournament</label>
                  <select className="input-field w-full" value={activeTournamentId} onChange={(e) => setActiveTournamentId(e.target.value)}>
                    {tournaments.length === 0 && <option value="">None yet</option>}
                    {tournaments.map((t) => <option key={t._id} value={t._id}>{t.name} ({t.status.replace('-', ' ')})</option>)}
                  </select>
                  {activeTournament && (
                    <p className="text-xs text-slate-400 ml-1">
                      {FORMATS.find((f) => f.value === activeTournament.format)?.label} · {activeTournament.teams.length} teams ·{' '}
                      <Link href={`/tournaments/${activeTournament.publicSlug}`} className="text-primary inline-flex items-center gap-1">public page <ExternalLink className="w-3 h-3" /></Link>
                    </p>
                  )}
                  {activeTournament?.format === 'groups-knockout' && activeTournament.status === 'draft' && (
                    <input type="number" min="2" max="8" className="input-field w-full text-sm" placeholder="Number of groups (default: about 4 teams per group)" value={groupCount} onChange={(e) => setGroupCount(e.target.value)} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={handleOpenTeamManager} disabled={!activeTournament} className={`glass-panel p-4 flex flex-col items-center justify-center gap-3 transition-colors ${!activeTournament ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 border border-transparent hover:border-slate-600 active:scale-95'}`}>
                    <Users className="w-6 h-6 text-accent" />
                    <span className="text-xs font-medium text-slate-300">Manage Teams</span>
                  </button>
                  <button onClick={handleGenerateDraw} disabled={!activeTournament} className={`glass-panel p-4 flex flex-col items-center justify-center gap-3 transition-colors ${!activeTournament ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 border border-transparent hover:border-slate-600 active:scale-95'}`}>
                    <Settings className="w-6 h-6 text-slate-400" />
                    <span className="text-xs font-medium text-slate-300">Generate Draw</span>
                  </button>
                  {activeTournament?.format === 'groups-knockout' && activeTournament.status !== 'draft' && (
                    <button onClick={handleGenerateKnockout} className="glass-panel p-4 flex flex-col items-center justify-center gap-3 col-span-2 hover:bg-white/5 border border-transparent hover:border-slate-600 active:scale-95">
                      <GitBranch className="w-6 h-6 text-yellow-400" />
                      <span className="text-xs font-medium text-slate-300">Generate knockout from group tables</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'players' && isAdmin && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400 pl-2">Scorers can score the matches they are assigned to.</p>
            {players.map((p) => {
              const isScorer = p.roles.includes('scorer');
              return (
                <div key={p._id} className="glass-panel p-4 flex items-center justify-between gap-3">
                  <Link href={`/players/${p._id}`} className="font-semibold hover:text-primary truncate">{p.name}</Link>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    {p.roles.includes('admin') && <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-300">Admin</span>}
                    <button onClick={() => handleRole(p, 'scorer', isScorer ? 'revoke' : 'grant')}
                      className={`px-3 py-1 rounded-full border ${isScorer ? 'border-primary/40 text-primary' : 'border-slate-600 text-slate-400'}`}>
                      {isScorer ? 'Scorer ✓' : 'Make scorer'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
