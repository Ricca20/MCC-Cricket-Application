const mongoose = require('mongoose');

const inningsSchema = new mongoose.Schema({
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
  battingTeam: { type: String, required: true },
  bowlingTeam: { type: String, required: true },
  totalRuns: { type: Number, default: 0 },
  totalWickets: { type: Number, default: 0 },
  totalOvers: { type: Number, default: 0 },
  extras: { type: Number, default: 0 },
  currentBatsmen: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // or store as string if visiting
  currentBowler: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // or store as string if visiting
  deliveries: [{
    clientEntryId: { type: String }, // UUID generated on-device, used for offline dedupe on sync
    over: { type: Number }, 
    ballInOver: { type: Number },
    bowler: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // null if visiting
    bowlerName: { type: String }, // store name for visiting teams
    batsman: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // null if visiting
    batsmanName: { type: String }, // store name for visiting teams
    runs: { type: Number, default: 0 },
    extraType: { type: String, enum: [null, 'wide', 'noball', 'bye', 'legbye'], default: null },
    wicket: { 
      type: { type: String }, // 'bowled', 'caught', 'runout', etc.
      playerOut: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
      playerOutName: { type: String },
      fielder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      fielderName: { type: String }
    }, // null if no wicket
    timestamp: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('Innings', inningsSchema);
