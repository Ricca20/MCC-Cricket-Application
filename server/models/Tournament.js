const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  format: { type: String, enum: ['round-robin', 'knockout', 'groups-knockout'], required: true },
  teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
  status: { type: String, enum: ['draft', 'draw-published', 'in-progress', 'completed'], default: 'draft' },
  publicSlug: { type: String, unique: true, required: true },
  startDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tournament', tournamentSchema);
