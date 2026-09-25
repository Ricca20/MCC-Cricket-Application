const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  isClubTeam: { type: Boolean, default: false },
  players: [{
    name: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null } // null for visiting-team players (name-only)
  }]
});

module.exports = mongoose.model('Team', teamSchema);
