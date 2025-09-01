const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    otp: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 600 // OTP expires in 10 minutes (600 seconds)
    },
    isUsed: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('OTP', otpSchema);