const mongoose = require('mongoose');

const VideoCallSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  roomId: { type: String, required: true },
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    joinedAt: { type: Date, default: Date.now },
    leftAt: Date,
    isActive: { type: Boolean, default: true }
  }],
  startedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String
  },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  duration: Number,
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('VideoCall', VideoCallSchema);