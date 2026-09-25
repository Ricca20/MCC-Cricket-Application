const mongoose = require('mongoose');

const fixtureSchema = new mongoose.Schema({
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  round: { type: String, required: true }, // e.g., "Group A", "Quarterfinal", "Round 1"
  teamA: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }, // null if bye/TBD
  teamB: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }, // null if bye/TBD
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null }, // linked once match is created/played
  scheduledDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Fixture', fixtureSchema);
