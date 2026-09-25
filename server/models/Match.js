const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  matchType: { type: String, enum: ['practice', 'friendly', 'tournament'], required: true },
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },
  date: { type: Date, required: true },
  venue: { type: String },
  oversLimit: { type: Number, required: true },
  teamA: { 
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }, 
    name: { type: String, required: true } 
  },
  teamB: { 
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }, 
    name: { type: String, required: true } 
  },
  toss: { 
    winner: { type: String }, 
    decision: { type: String, enum: ['bat', 'bowl'] } 
  },
  status: { type: String, enum: ['upcoming', 'live', 'completed'], default: 'upcoming' },
  scorerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPublic: { type: Boolean, default: true },
  publicSlug: { type: String, unique: true }, // unique short code, e.g. "match-8f3k2"
  result: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);
