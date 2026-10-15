const mongoose = require('mongoose');
const { EXTRA_TYPES, WICKET_TYPES } = require('../lib/cricketRules');

// Players are identified by name; userId is set only for registered club members
const deliverySchema = new mongoose.Schema({
  clientEntryId: { type: String, required: true }, // UUID generated on-device, used for offline dedupe on sync
  over: { type: Number },
  ballInOver: { type: Number },
  bowler: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  bowlerName: { type: String, required: true },
  batsman: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  batsmanName: { type: String, required: true },
  nonStriker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  nonStrikerName: { type: String },
  runs: { type: Number, default: 0 },
  extraType: { type: String, enum: [null, ...EXTRA_TYPES], default: null },
  wicket: {
    type: new mongoose.Schema({
      type: { type: String, enum: WICKET_TYPES, required: true },
      playerOut: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      playerOutName: { type: String },
      fielder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      fielderName: { type: String }
    }, { _id: false }),
    default: null
  },
  timestamp: { type: Date, default: Date.now }
});

const inningsSchema = new mongoose.Schema({
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
  inningsNumber: { type: Number, enum: [1, 2], required: true },
  status: { type: String, enum: ['in-progress', 'completed'], default: 'in-progress' },
  battingSide: { type: String, enum: ['A', 'B'], required: true },
  battingTeam: { type: String, required: true },
  bowlingTeam: { type: String, required: true },
  maxWickets: { type: Number, default: 10 },
  target: { type: Number, default: null },
  totalRuns: { type: Number, default: 0 },
  totalWickets: { type: Number, default: 0 },
  totalOvers: { type: Number, default: 0 },
  legalBalls: { type: Number, default: 0 },
  extras: { type: Number, default: 0 },
  deliveries: [deliverySchema]
});

inningsSchema.index({ matchId: 1, inningsNumber: 1 }, { unique: true });
inningsSchema.index({ 'deliveries.batsman': 1 });
inningsSchema.index({ 'deliveries.bowler': 1 });
inningsSchema.index({ 'deliveries.wicket.fielder': 1 });

module.exports = mongoose.model('Innings', inningsSchema);
