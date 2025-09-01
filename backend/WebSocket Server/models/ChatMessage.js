const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  sender: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true }
  },
  content: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['text', 'file', 'image', 'video_call_start', 'video_call_end', 'user_joined', 'user_left'],
    default: 'text'
  },
  metadata: {
    fileName: String,
    fileSize: Number,
    fileType: String,
    callDuration: Number
  },
  timestamp: { type: Date, default: Date.now },
  edited: { type: Boolean, default: false },
  editedAt: Date,
  reactions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: String,
    timestamp: { type: Date, default: Date.now }
  }],
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' },
  deleted: { type: Boolean, default: false },
  deletedAt: Date
});

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);