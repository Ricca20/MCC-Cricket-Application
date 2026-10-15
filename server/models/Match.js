const mongoose = require('mongoose');

const rosterPlayerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { _id: false });

const matchTeamSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  name: { type: String, required: true },
  players: { type: [rosterPlayerSchema], default: [] } // roster snapshot at match creation
}, { _id: false });

const matchSchema = new mongoose.Schema({
  matchType: { type: String, enum: ['practice', 'friendly', 'tournament'], required: true },
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },
  fixtureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fixture', default: null },
  date: { type: Date, required: true },
  venue: { type: String },
  oversLimit: { type: Number, required: true },
  teamA: { type: matchTeamSchema, required: true },
  teamB: { type: matchTeamSchema, required: true },
  toss: { 
    winner: { type: String, enum: ['A', 'B'] }, 
    decision: { type: String, enum: ['bat', 'bowl'] } 
  },
  status: { type: String, enum: ['upcoming', 'live', 'completed'], default: 'upcoming' },
  scorerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPublic: { type: Boolean, default: true },
  publicSlug: { type: String, unique: true, required: true },
  result: { type: String },
  winner: { type: String, enum: ['A', 'B', null], default: null }, // null = tie / no result
  statsApplied: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

matchSchema.methods.side = function (key) {
  return key === 'A' ? this.teamA : this.teamB;
};

module.exports = mongoose.model('Match', matchSchema);
