const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  roles: { 
    type: [String], 
    enum: ['admin', 'scorer', 'player'], 
    default: ['player'] 
  },
  battingStyle: { type: String },
  bowlingStyle: { type: String },
  nickname: { type: String },
  jerseyNumber: { type: Number, unique: true, sparse: true },
  profilePhoto: { type: String },
  pushSubscriptions: { type: Array, default: [] },
  tokenVersion: { type: Number, default: 0 }, // bumped on logout to revoke refresh tokens
  joinedDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Never serialise secrets, whatever query produced the document
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.pushSubscriptions;
    delete ret.tokenVersion;
    delete ret.__v;
    return ret;
  }
});

// Fields safe to show anyone, including logged-out visitors
userSchema.statics.PUBLIC_FIELDS = 'name nickname jerseyNumber profilePhoto battingStyle bowlingStyle roles joinedDate';

module.exports = mongoose.model('User', userSchema);
