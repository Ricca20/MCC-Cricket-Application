const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  roles: { 
    type: [String], 
    enum: ['admin', 'scorer', 'player'], 
    default: ['player'] 
  },
  battingStyle: { type: String },
  bowlingStyle: { type: String },
  profilePhoto: { type: String },
  pushSubscriptions: { type: Array, default: [] },
  joinedDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
