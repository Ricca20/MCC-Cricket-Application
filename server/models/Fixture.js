const mongoose = require('mongoose');

const fixtureSchema = new mongoose.Schema({
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  stage: { type: String, enum: ['league', 'group', 'knockout'], required: true },
  round: { type: String, required: true }, // e.g., "Group A", "Quarter-final", "Round 1"
  roundNumber: { type: Number, required: true },
  group: { type: String, default: null },
  teamA: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null }, // null while TBD
  teamB: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null }, // null if bye/TBD
  isBye: { type: Boolean, default: false },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  nextFixture: { type: mongoose.Schema.Types.ObjectId, ref: 'Fixture', default: null },
  nextSlot: { type: String, enum: ['A', 'B', null], default: null },
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null }, // linked once match is created/played
  scheduledDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Fixture', fixtureSchema);
