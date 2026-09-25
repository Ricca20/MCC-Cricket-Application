const mongoose = require('mongoose');

const playerStatsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  matchesPlayed: { type: Number, default: 0 },
  runs: { type: Number, default: 0 },
  ballsFaced: { type: Number, default: 0 },
  highScore: { type: Number, default: 0 },
  fifties: { type: Number, default: 0 },
  hundreds: { type: Number, default: 0 },
  battingAverage: { type: Number, default: 0 },
  strikeRate: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  oversBowled: { type: Number, default: 0 },
  runsConceded: { type: Number, default: 0 },
  bestBowling: { type: String, default: '-' },
  economy: { type: Number, default: 0 },
  threeWicketHauls: { type: Number, default: 0 },
  catches: { type: Number, default: 0 },
  runOuts: { type: Number, default: 0 },
  stumpings: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

// Automatically update `updatedAt` before save
playerStatsSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PlayerStats', playerStatsSchema);
