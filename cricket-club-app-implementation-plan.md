# Village Cricket Club App — Implementation Plan

**Purpose of this document:** a complete technical spec an AI coding agent (Claude Code, Cursor, etc.) can build from directly — architecture, data models, API contract, and a phased build order. Single-club scope (not multi-tenant).

---

## 1. Product Summary

A mobile-first web app (PWA) for a village cricket club to:
- Maintain a registered player pool with career stats
- Score matches ball-by-ball (practice, friendlies, tournaments)
- Broadcast live scoreboards to a **public, no-login link**
- Run tournaments (round-robin / knockout / groups+knockout) with auto-generated, public draws
- Let players check their own performance history anytime

Roles: **Admin** (full control, grants Scorer access) · **Scorer** (club members granted live-scoring access) · **Player** (own profile + match history) · **Public/Guest** (read-only, via link, no account).

Visiting/opponent teams are **not** registered users — just names entered against a match.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js (App Router) + Tailwind CSS**, PWA via `next-pwa` | Matches your Pasovit-internship stack; PWA gives installable home-screen app + offline shell without native app overhead |
| Backend | **Node.js + Express + Socket.io** | Same MERN skillset; Socket.io handles real-time score broadcast to viewers |
| Database | **MongoDB (Mongoose)**, hosted on **MongoDB Atlas free tier (M0)** | Flexible schema fits ball-by-ball event logs well; zero cost at this scale |
| Auth | **JWT (access + refresh tokens)**, bcrypt password hashing | Simple, no vendor lock-in, standard MERN pattern |
| Offline queue | **Dexie.js (IndexedDB wrapper)** on the scorer's device | Covers the occasional signal-drop case without redesigning the whole app around offline-first |
| Hosting | Frontend → **Vercel** (free) · Backend+Socket.io → **Render or Railway** (free tier) · DB → **Atlas M0** (free) | Fits the "low resource" constraint — $0 to start |
| Charts (Phase 3) | **Recharts** | Lightweight, works well in Next.js |

Repo layout — a simple two-package monorepo:
```
cricket-club-app/
├── web/        # Next.js frontend (PWA)
└── server/     # Express + Socket.io + Mongoose backend
```

---

## 3. Data Models (Mongoose Schemas)

### User
```js
{
  name: String,
  email: String, // unique
  passwordHash: String,
  roles: [String], // ["admin"] | ["scorer"] | ["player"] — a user can hold multiple
  battingStyle: String, // optional
  bowlingStyle: String, // optional
  profilePhoto: String,
  joinedDate: Date,
  createdAt: Date
}
```

### PlayerStats (denormalized/cached; recomputed after each match)
```js
{
  userId: ObjectId,
  matchesPlayed: Number,
  runs: Number, ballsFaced: Number, highScore: Number,
  fifties: Number, hundreds: Number,
  battingAverage: Number, strikeRate: Number,
  wickets: Number, oversBowled: Number, runsConceded: Number,
  bestBowling: String, // "4/23"
  economy: Number, threeWicketHauls: Number,
  catches: Number, runOuts: Number, stumpings: Number,
  updatedAt: Date
}
```

### Team (used for both club XI selections and visiting teams)
```js
{
  name: String,
  isClubTeam: Boolean,
  players: [{
    name: String,
    userId: ObjectId // null for visiting-team players (name-only)
  }]
}
```

### Match
```js
{
  matchType: String, // "practice" | "friendly" | "tournament"
  tournamentId: ObjectId, // null unless part of a tournament
  date: Date,
  venue: String,
  oversLimit: Number,
  teamA: { teamId: ObjectId, name: String },
  teamB: { teamId: ObjectId, name: String },
  toss: { winner: String, decision: String }, // "bat" | "bowl"
  status: String, // "upcoming" | "live" | "completed"
  scorerId: ObjectId,
  isPublic: Boolean,
  publicSlug: String, // unique short code, e.g. "match-8f3k2"
  result: String,
  createdAt: Date
}
```

### Innings
```js
{
  matchId: ObjectId,
  battingTeam: String,
  bowlingTeam: String,
  totalRuns: Number, totalWickets: Number, totalOvers: Number, extras: Number,
  currentBatsmen: [ObjectId], currentBowler: ObjectId,
  deliveries: [{
    clientEntryId: String, // UUID generated on-device, used for offline dedupe on sync
    over: Number, ballInOver: Number,
    bowler: ObjectId, batsman: ObjectId,
    runs: Number,
    extraType: String, // null | "wide" | "noball" | "bye" | "legbye"
    wicket: { type: String, playerOut: ObjectId, fielder: ObjectId }, // null if no wicket
    timestamp: Date
  }]
}
```

### Tournament
```js
{
  name: String,
  format: String, // "round-robin" | "knockout" | "groups-knockout"
  teams: [ObjectId], // Team refs
  status: String, // "draft" | "draw-published" | "in-progress" | "completed"
  publicSlug: String,
  startDate: Date
}
```

### Fixture
```js
{
  tournamentId: ObjectId,
  round: String, // "Group A", "Quarterfinal", "Round 1", etc.
  teamA: ObjectId, teamB: ObjectId,
  matchId: ObjectId, // linked once the match is created/played
  scheduledDate: Date
}
```

Standings/points tables are **computed on read** from completed fixtures + match results (not stored) — simpler and always consistent.

---

## 4. Permissions Matrix

| Action | Admin | Scorer | Player | Public |
|---|---|---|---|---|
| Register/manage own profile | ✅ | ✅ | ✅ | ❌ |
| Grant scorer role | ✅ | ❌ | ❌ | ❌ |
| Create match / assign scorer | ✅ | ❌ | ❌ | ❌ |
| Enter ball-by-ball score | ✅ | ✅ (assigned matches) | ❌ | ❌ |
| View own stats & history | ✅ | ✅ | ✅ | ❌ |
| View public scoreboard/tournament link | ✅ | ✅ | ✅ | ✅ (no login) |
| Create/manage tournament, generate draw | ✅ | ❌ | ❌ | ❌ |

---

## 5. Core Flows

### 5.1 Live scoring (ball-by-ball)
1. Admin creates match, assigns a scorer.
2. Scorer opens a mobile-optimized scoring screen: big tap targets for runs (0–6), extras, wicket type, next batsman/bowler prompts.
3. Each ball emits a `clientEntryId` (UUID) generated on-device **before** sending, so:
   - If online: POST to `/api/matches/:id/deliveries` → server appends to `Innings.deliveries`, broadcasts via Socket.io room `match:{id}` → all public viewers' scoreboards update live.
   - If offline: entry queued in Dexie.js (IndexedDB) locally; a background sync worker retries POST when connectivity returns. Server dedupes by `clientEntryId` so a retried ball is never double-counted.
4. On innings/match completion: server recomputes affected players' `PlayerStats` in one aggregation pass.

### 5.2 Tournament draw
1. Admin creates tournament, adds teams (club + visiting, name-only), picks format.
2. Admin clicks "Generate Draw":
   - **Round-robin:** circle method — every team plays every other team once (or twice, if configurable).
   - **Knockout:** shuffle teams, pad with byes to the next power of 2, pair up bracket.
   - **Groups → knockout:** split teams into groups (round-robin within group), then top N per group feed a knockout bracket generated after group stage completes.
3. Fixtures saved; `tournament.status = "draw-published"`; public page shows fixtures + (once matches are played) live standings/bracket.

### 5.3 Public viewing
- `/live/[matchSlug]` — read-only live scoreboard, subscribes to `match:{id}` socket room, no auth.
- `/tournament/[tournamentSlug]` — fixtures, standings/bracket, links into each match's live/scorecard page.

---

## 6. API Route Plan

```
POST   /api/auth/register              player signs up
POST   /api/auth/login
GET    /api/players                    club player pool
GET    /api/players/:id                profile + stats + match history
PATCH  /api/players/:id/role           admin grants scorer role

POST   /api/matches                    admin creates match
GET    /api/matches/:id
GET    /api/matches/live/:slug         public, no auth
POST   /api/matches/:id/deliveries     scorer submits a ball (supports offline sync/dedupe)
POST   /api/matches/:id/complete       finalize match, trigger stats recompute

POST   /api/teams                      create team (club or visiting)

POST   /api/tournaments
POST   /api/tournaments/:id/teams
POST   /api/tournaments/:id/generate-draw
GET    /api/tournaments/:id/standings
GET    /api/tournaments/live/:slug     public, no auth
```

Socket.io events: `match:{id}:delivery` (new ball), `match:{id}:status` (started/completed), `tournament:{id}:update` (fixture result posted).

---

## 7. Phased Build Order

### Phase 1 — MVP
1. Auth + roles (seed one admin manually)
2. Player registration/profile CRUD + club player pool listing
3. Team creation (club + visiting, name-only players)
4. Match creation + ball-by-ball scoring screen (online path first)
5. Public live scoreboard page (Socket.io broadcast)
6. Match completion → stats recompute → player profile shows career stats + match history

### Phase 2 — Offline + Tournaments
7. Dexie.js offline queue + sync worker + server-side dedupe by `clientEntryId`
8. Tournament creation, team entry, draw generation (all 3 formats)
9. Public tournament page: fixtures, standings/bracket
10. Linking a fixture to an actual scorable match

### Phase 3 — Polish
11. Player stat trend charts (Recharts)
12. Web push notifications (match start, milestones)
13. Admin correction tools (edit a wrongly entered ball/match)
14. Shareable match-summary export (image/text) for social posting

---

## 8. Notes for the Building Agent
- Build Phase 1 fully online-only first — don't build offline sync until the online scoring flow and stats recompute are solid.
- Use MongoDB transactions when writing a delivery **and** updating live innings totals together, to avoid score drift under concurrent writes.
- Keep `publicSlug` generation short and URL-safe (nanoid, 6–8 chars) — these links get shared informally (WhatsApp, etc.).
- Recompute `PlayerStats` as a batch job triggered on match completion, not on every single delivery — keeps live scoring fast.
