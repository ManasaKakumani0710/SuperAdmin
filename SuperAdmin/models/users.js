const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  username:String,
  userType: {
    type: String,
    enum: ['general', 'influencer', 'vendor'],
    required: true
  },

  // Common Fields
  country: String,
  state: String,
  gender: String,
  dob: Date,
  isVerified: { type: Boolean, default: false },
  isProfileSetup: {
    type: Boolean,
    default: false
  },

  // OTP + Reset
  stripeAccountId:String,

  // Optional per userType
  brand: String,
  followers: Number,

  status: {
    type: String,
    default: 'Pending'
  },
  isBan: {
    type: Boolean,
    default: false
  },

  // Flexible Profile
  profile: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);