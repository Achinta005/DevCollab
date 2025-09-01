const WebSocket = require('ws');
const http = require('http');
const { setupWSConnection, docs } = require("y-websocket/bin/utils");
const Y = require('yjs');
const mongoose = require('mongoose');
const connectMongoDB=require('./config/db')

// Importing Schema
const ChatMessage = require("./models/ChatMessage");
const VideoCall = require("./models/VideoCall");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store for room-specific data
const rooms = new Map();
const videoCallRooms = new Map();

// ICE servers configuration for WebRTC
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

connectMongoDB();

mongoose.connection.on('error', err => {
  console.error('MongoDB error:', err);
});

// Enhanced WebSocket connection handler
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const params = url.searchParams;
  
  const roomId = url.pathname.slice(1);
  const userId = params.get('userId');
  const userName = params.get('userName');
  const token = params.get('token');
  const fileId = params.get('fileId');
  const projectId = params.get('projectId');

  console.log(`New connection to room: ${roomId}, user: ${userName} (${userId})`);

  // Basic authentication and validation check
  if (!token || !userId || !projectId || !roomId || !userName || !/^[a-zA-Z0-9_-]+$/.test(roomId) || userName.length > 50) {
    console.log('Connection rejected: Missing or invalid parameters');
    ws.close(1008, 'Authentication required or invalid parameters');
    return;
  }

  // Store connection metadata
  ws.roomId = roomId;
  ws.userId = userId;
  ws.userName = userName;
  ws.fileId = fileId;
  ws.projectId = projectId;
  ws.isAlive = true;

  // Initialize room if it doesn't exist
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      connections: new Map(),
      document: new Y.Doc(),
      lastAccess: Date.now(),
      fileId,
      projectId,
      chatHistory: [],
      activeVideoCall: null
    });
  }

  const room = rooms.get(roomId);
  room.connections.set(ws.userId, ws);
  room.lastAccess = Date.now();

  // Setup Yjs WebSocket connection
  setupWSConnection(ws, req, {
    docName: roomId,
    gc: true
  });

  // Broadcast user joined message
  broadcastToRoom(roomId, {
    type: 'user_joined',
    user: { userId, userName },
    timestamp: new Date().toISOString()
  }, ws.userId);

  // Save user joined message to database
  saveChatMessage(projectId, {
    userId,
    userName
  }, `${userName} joined the project`, 'user_joined');

  // Send recent chat history to newly connected user
  getChatHistory(projectId, 50).then(messages => {
    ws.send(JSON.stringify({
      type: 'chat_history',
      messages: messages
    }));
  }).catch(error => {
    console.error('Error sending chat history:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to load chat history' }));
  });

  // WebSocket message handler
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'chat_message':
          await handleChatMessage(ws, data);
          break;
        case 'video_call_offer':
          handleVideoCallOffer(ws, data);
          break;
        case 'video_call_answer':
          handleVideoCallAnswer(ws, data);
          break;
        case 'video_call_ice_candidate':
          handleVideoCallIceCandidate(ws, data);
          break;
        case 'video_call_start':
          await handleVideoCallStart(ws, data);
          break;
        case 'video_call_end':
          await handleVideoCallEnd(ws, data);
          break;
        case 'video_call_join':
          await handleVideoCallJoin(ws, data);
          break;
        case 'video_call_leave':
          await handleVideoCallLeave(ws, data);
          break;
        case 'typing_start':
          handleTypingStart(ws, data);
          break;
        case 'typing_stop':
          handleTypingStop(ws, data);
          break;
        case 'message_reaction':
          await handleMessageReaction(ws, data);
          break;
        case 'message_edit':
          await handleMessageEdit(ws, data);
          break;
        case 'message_delete':
          await handleMessageDelete(ws, data);
          break;
        default:
          ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${data.type}` }));
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  // Handle connection close
  ws.on('close', async () => {
    console.log(`User ${userName} (${userId}) disconnected from room: ${roomId}`);
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.connections.delete(ws.userId);
      
      // Broadcast user left message
      broadcastToRoom(roomId, {
        type: 'user_left',
        user: { userId, userName },
        timestamp: new Date().toISOString()
      });

      // Save user left message to database
      await saveChatMessage(projectId, {
        userId,
        userName
      }, `${userName} left the project`, 'user_left');

      // Handle video call cleanup if user was in call
      if (room.activeVideoCall && room.activeVideoCall.participants.has(userId)) {
        await handleVideoCallLeave(ws, { callId: room.activeVideoCall.id });
      }
      
      // Clean up empty rooms with improved check
      if (room.connections.size === 0) {
        setTimeout(() => {
          if (rooms.has(roomId) && rooms.get(roomId).connections.size === 0 && Date.now() - rooms.get(roomId).lastAccess > 5 * 60 * 1000) {
            console.log(`Cleaning up empty room: ${roomId}`);
            rooms.delete(roomId);
            
            if (docs.has(roomId)) {
              docs.get(roomId).destroy();
              docs.delete(roomId);
            }
          }
        }, 5 * 60 * 1000);
      }
    }
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for user ${userName} (${userId}):`, error);
  });

  // Heartbeat
  ws.on('pong', () => {
    ws.isAlive = true;
  });
});

// Chat message handler
async function handleChatMessage(ws, data) {
  try {
    const message = await saveChatMessage(
      ws.projectId,
      { userId: ws.userId, userName: ws.userName },
      data.content,
      data.messageType || 'text',
      data.metadata,
      data.replyTo
    );

    broadcastToRoom(ws.roomId, {
      type: 'chat_message',
      message: message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error handling chat message:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to send chat message' }));
  }
}

// Video call handlers
async function handleVideoCallStart(ws, data) {
  try {
    const callId = generateCallId();
    const videoCall = new VideoCall({
      projectId: ws.projectId,
      roomId: ws.roomId,
      participants: [{
        userId: ws.userId,
        userName: ws.userName,
        joinedAt: new Date(),
        isActive: true
      }],
      startedBy: {
        userId: ws.userId,
        userName: ws.userName
      },
      isActive: true,
      startTime: new Date()
    });

    await videoCall.save();

    const room = rooms.get(ws.roomId);
    if (!room) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      return;
    }

    room.activeVideoCall = {
      id: callId,
      dbId: videoCall._id,
      participants: new Map([[ws.userId, ws]]),
      startedBy: ws.userId,
      startTime: new Date()
    };

    videoCallRooms.set(callId, ws.roomId);

    // Broadcast to all users in the room that a call has started
    broadcastToRoom(ws.roomId, {
      type: 'video_call_started',
      callId: callId,
      startedBy: { userId: ws.userId, userName: ws.userName },
      iceServers: iceServers,
      participants: [{ userId: ws.userId, userName: ws.userName }]
    });

    // Save video call start message
    await saveChatMessage(
      ws.projectId,
      { userId: ws.userId, userName: ws.userName },
      `${ws.userName} started a video call`,
      'video_call_start',
      { callId }
    );

    console.log(`Video call ${callId} started by ${ws.userName} in room ${ws.roomId}`);

  } catch (error) {
    console.error('Error starting video call:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to start video call' }));
  }
}

async function handleVideoCallJoin(ws, data) {
  try {
    const { callId } = data;
    const roomId = videoCallRooms.get(callId);
    
    if (!roomId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Video call not found' }));
      return;
    }

    const room = rooms.get(roomId);
    if (!room || !room.activeVideoCall) {
      ws.send(JSON.stringify({ type: 'error', message: 'Video call not active' }));
      return;
    }

    // Add user to call participants
    room.activeVideoCall.participants.set(ws.userId, ws);

    // Update database
    await VideoCall.findByIdAndUpdate(room.activeVideoCall.dbId, {
      $push: {
        participants: {
          userId: ws.userId,
          userName: ws.userName,
          joinedAt: new Date(),
          isActive: true
        }
      }
    });

    // Get all current participants for broadcasting
    const participantsList = Array.from(room.activeVideoCall.participants.entries()).map(([id, socket]) => ({
      userId: id,
      userName: socket.userName
    }));

    // Notify all participants that a new user joined
    broadcastToRoom(roomId, {
      type: 'video_call_user_joined',
      callId: callId,
      user: { userId: ws.userId, userName: ws.userName },
      participants: participantsList
    });

    // Send current participants list to the newly joined user
    ws.send(JSON.stringify({
      type: 'video_call_participants',
      callId: callId,
      participants: participantsList
    }));

    console.log(`${ws.userName} joined video call ${callId}. Participants: ${participantsList.length}`);

  } catch (error) {
    console.error('Error joining video call:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to join video call' }));
  }
}

async function handleVideoCallLeave(ws, data) {
  try {
    const room = rooms.get(ws.roomId);
    if (!room || !room.activeVideoCall) return;

    const callId = room.activeVideoCall.id;
    
    // Remove user from call participants
    room.activeVideoCall.participants.delete(ws.userId);

    // Update database
    await VideoCall.findByIdAndUpdate(room.activeVideoCall.dbId, {
      $set: {
        'participants.$[elem].leftAt': new Date(),
        'participants.$[elem].isActive': false
      }
    }, {
      arrayFilters: [{ 'elem.userId': ws.userId }]
    });

    // Notify remaining participants
    const remainingParticipants = Array.from(room.activeVideoCall.participants.keys());
    
    broadcastToRoom(ws.roomId, {
      type: 'video_call_user_left',
      callId: callId,
      user: { userId: ws.userId, userName: ws.userName },
      participants: remainingParticipants
    });

    // Save video call leave message
    await saveChatMessage(
      ws.projectId,
      { userId: ws.userId, userName: ws.userName },
      `${ws.userName} left the video call`,
      'video_call_leave',
      { callId }
    );

    console.log(`${ws.userName} left video call ${callId}. Remaining: ${remainingParticipants.length}`);

    // End call if no participants left
    if (room.activeVideoCall.participants.size === 0) {
      await handleVideoCallEnd(ws, { callId: callId });
    }

  } catch (error) {
    console.error('Error leaving video call:', error);
  }
}

async function handleVideoCallEnd(ws, data) {
  try {
    const room = rooms.get(ws.roomId);
    if (!room || !room.activeVideoCall) return;

    const callId = room.activeVideoCall.id;
    const endTime = new Date();
    const duration = Math.floor((endTime - room.activeVideoCall.startTime) / 1000);

    // Update database
    await VideoCall.findByIdAndUpdate(room.activeVideoCall.dbId, {
      endTime: endTime,
      duration: duration,
      isActive: false
    });

    // Notify all participants that call ended
    broadcastToRoom(ws.roomId, {
      type: 'video_call_ended',
      callId: callId,
      duration: duration,
      endedBy: { userId: ws.userId, userName: ws.userName }
    });

    // Save video call end message
    await saveChatMessage(
      ws.projectId,
      { userId: ws.userId, userName: ws.userName },
      `Video call ended (${formatDuration(duration)})`,
      'video_call_end',
      { duration }
    );

    // Cleanup
    videoCallRooms.delete(callId);
    room.activeVideoCall = null;

    console.log(`Video call ${callId} ended by ${ws.userName}. Duration: ${duration}s`);

  } catch (error) {
    console.error('Error ending video call:', error);
  }
}

function handleVideoCallOffer(ws, data) {
  try {
    const { targetUserId, offer, callId } = data;
    const room = rooms.get(ws.roomId);
    
    if (!room) {
      console.error('Room not found for offer:', ws.roomId);
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      return;
    }

    if (!room.connections.has(targetUserId)) {
      console.error('Target user not found in room:', targetUserId);
      ws.send(JSON.stringify({
        type: 'error',
        message: `User ${targetUserId} not found in room`
      }));
      return;
    }

    const targetWs = room.connections.get(targetUserId);
    if (targetWs.readyState !== WebSocket.OPEN) {
      console.error('Target WebSocket not open:', targetUserId);
      ws.send(JSON.stringify({ type: 'error', message: 'Target user disconnected' }));
      return;
    }

    // Forward the offer to target user
    targetWs.send(JSON.stringify({
      type: 'video_call_offer',
      offer: offer,
      callId: callId,
      fromUser: { userId: ws.userId, userName: ws.userName }
    }));

    console.log(`Forwarded offer from ${ws.userName} to ${targetWs.userName}`);

  } catch (error) {
    console.error('Error handling video call offer:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to handle video call offer' }));
  }
}

function handleVideoCallAnswer(ws, data) {
  try {
    const { targetUserId, answer, callId } = data;
    const room = rooms.get(ws.roomId);
    
    if (!room) {
      console.error('Room not found for answer:', ws.roomId);
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      return;
    }

    if (!room.connections.has(targetUserId)) {
      console.error('Target user not found in room for answer:', targetUserId);
      ws.send(JSON.stringify({ type: 'error', message: `User ${targetUserId} not found in room` }));
      return;
    }

    const targetWs = room.connections.get(targetUserId);
    if (targetWs.readyState !== WebSocket.OPEN) {
      console.error('Target WebSocket not open for answer:', targetUserId);
      ws.send(JSON.stringify({ type: 'error', message: 'Target user disconnected' }));
      return;
    }

    // Forward the answer to target user
    targetWs.send(JSON.stringify({
      type: 'video_call_answer',
      answer: answer,
      callId: callId,
      fromUser: { userId: ws.userId, userName: ws.userName }
    }));

    console.log(`Forwarded answer from ${ws.userName} to ${targetWs.userName}`);

  } catch (error) {
    console.error('Error handling video call answer:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to handle video call answer' }));
  }
}

function handleVideoCallIceCandidate(ws, data) {
  try {
    const { targetUserId, candidate, callId } = data;
    const room = rooms.get(ws.roomId);
    
    if (!room) {
      console.error('Room not found for ICE candidate:', ws.roomId);
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      return;
    }

    if (!room.connections.has(targetUserId)) {
      console.error('Target user not found in room for ICE candidate:', targetUserId);
      ws.send(JSON.stringify({ type: 'error', message: `User ${targetUserId} not found in room` }));
      return;
    }

    const targetWs = room.connections.get(targetUserId);
    if (targetWs.readyState !== WebSocket.OPEN) {
      console.error('Target WebSocket not open for ICE candidate:', targetUserId);
      ws.send(JSON.stringify({ type: 'error', message: 'Target user disconnected' }));
      return;
    }

    // Forward the ICE candidate to target user
    targetWs.send(JSON.stringify({
      type: 'video_call_ice_candidate',
      candidate: candidate,
      callId: callId,
      fromUser: { userId: ws.userId, userName: ws.userName }
    }));

    console.log(`Forwarded ICE candidate from ${ws.userName} to ${targetWs.userName}`);

  } catch (error) {
    console.error('Error handling ICE candidate:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to handle ICE candidate' }));
  }
}

// Typing indicators
function handleTypingStart(ws, data) {
  broadcastToRoom(ws.roomId, {
    type: 'typing_start',
    user: { userId: ws.userId, userName: ws.userName }
  }, ws.userId);
}

function handleTypingStop(ws, data) {
  broadcastToRoom(ws.roomId, {
    type: 'typing_stop',
    user: { userId: ws.userId, userName: ws.userName }
  }, ws.userId);
}

// Message reactions
async function handleMessageReaction(ws, data) {
  try {
    const { messageId, emoji, action } = data;
    
    const updateQuery = action === 'add' 
      ? { $push: { reactions: { userId: ws.userId, emoji, timestamp: new Date() } } }
      : { $pull: { reactions: { userId: ws.userId, emoji } } };

    const message = await ChatMessage.findByIdAndUpdate(messageId, updateQuery, { new: true });

    broadcastToRoom(ws.roomId, {
      type: 'message_reaction',
      messageId,
      reactions: message.reactions,
      action,
      user: { userId: ws.userId, userName: ws.userName }
    });

  } catch (error) {
    console.error('Error handling message reaction:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to handle message reaction' }));
  }
}

// Message editing
async function handleMessageEdit(ws, data) {
  try {
    const { messageId, newContent } = data;
    
    const message = await ChatMessage.findOneAndUpdate(
      { _id: messageId, 'sender.userId': ws.userId },
      { 
        content: newContent,
        edited: true,
        editedAt: new Date()
      },
      { new: true }
    );

    if (message) {
      broadcastToRoom(ws.roomId, {
        type: 'message_edited',
        message: message
      });
    } else {
      ws.send(JSON.stringify({ type: 'error', message: 'Message not found or unauthorized' }));
    }

  } catch (error) {
    console.error('Error editing message:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to edit message' }));
  }
}

// Message deletion
async function handleMessageDelete(ws, data) {
  try {
    const { messageId } = data;
    
    const message = await ChatMessage.findOneAndUpdate(
      { _id: messageId, 'sender.userId': ws.userId },
      { 
        deleted: true,
        deletedAt: new Date()
      },
      { new: true }
    );

    if (message) {
      broadcastToRoom(ws.roomId, {
        type: 'message_deleted',
        messageId: messageId,
        deletedBy: { userId: ws.userId, userName: ws.userName }
      });
    } else {
      ws.send(JSON.stringify({ type: 'error', message: 'Message not found or unauthorized' }));
    }

  } catch (error) {
    console.error('Error deleting message:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to delete message' }));
  }
}

// Helper functions
async function saveChatMessage(projectId, sender, content, type = 'text', metadata = null, replyTo = null) {
  try {
    const message = new ChatMessage({
      projectId,
      sender,
      content,
      type,
      metadata,
      replyTo
    });
    return await message.save();
  } catch (error) {
    console.error('Error saving chat message:', error);
    throw error;
  }
}

async function getChatHistory(projectId, limit = 50) {
  return await ChatMessage.find({ 
    projectId,
    deleted: false
  })
  .sort({ timestamp: -1 })
  .limit(limit)
  .populate('replyTo', 'content sender timestamp')
  .exec();
}

function broadcastToRoom(roomId, message, excludeUserId = null) {
  const room = rooms.get(roomId);
  if (!room) {
    console.error('Room not found for broadcast:', roomId);
    return;
  }

  const messageStr = JSON.stringify(message);
  let sentCount = 0;
  
  room.connections.forEach((ws, userId) => {
    if (excludeUserId && userId === excludeUserId) return;
    
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(messageStr);
        sentCount++;
      } catch (error) {
        console.error(`Failed to send message to user ${userId}:`, error);
      }
    } else {
      console.warn(`WebSocket for user ${userId} is not open, state: ${ws.readyState}`);
    }
  });

  console.log(`Broadcasted ${message.type} to ${sentCount}/${room.connections.size} users in room ${roomId}`);
}

function handleUserDisconnectFromVideoCall(ws) {
  try {
    const room = rooms.get(ws.roomId);
    if (!room || !room.activeVideoCall) return;

    if (room.activeVideoCall.participants.has(ws.userId)) {
      console.log(`User ${ws.userName} disconnected during video call`);
      
      // Remove from participants
      room.activeVideoCall.participants.delete(ws.userId);
      
      // Notify other participants
      broadcastToRoom(ws.roomId, {
        type: 'video_call_user_left',
        callId: room.activeVideoCall.id,
        user: { userId: ws.userId, userName: ws.userName },
        participants: Array.from(room.activeVideoCall.participants.keys()),
        reason: 'disconnected'
      }, ws.userId);

      // End call if no participants left
      if (room.activeVideoCall.participants.size === 0) {
        handleVideoCallEnd(ws, { callId: room.activeVideoCall.id });
      }
    }
  } catch (error) {
    console.error('Error handling user disconnect from video call:', error);
  }
}

function generateCallId() {
  return `call_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000;

  for (const [roomId, room] of rooms.entries()) {
    if (room.connections.size === 0 && now - room.lastAccess > maxAge) {
      console.log(`Cleaning up old room: ${roomId}`);
      rooms.delete(roomId);
      
      if (docs.has(roomId)) {
        docs.get(roomId).destroy();
        docs.delete(roomId);
      }
    }
  }
}, 30 * 60 * 1000);

// Heartbeat interval
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log(`Terminating connection for user ${ws.userId} due to missed heartbeat`);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// REST API handler for chat operations
async function handleRestAPI(req, res) {
  try {
    const urlParts = req.url.split('/');
    
    if (urlParts.length < 5 || urlParts[3] !== 'history' || req.method !== 'GET') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API endpoint not found' }));
      return;
    }
    
    const projectId = urlParts[4];
    if (!projectId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing projectId' }));
      return;
    }
    
    const limit = parseInt(req.url.split('limit=')[1]) || 50;
    const messages = await getChatHistory(projectId, limit);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages }));
  } catch (error) {
    console.error('REST API error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// Health check endpoint
server.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      activeRooms: rooms.size,
      totalConnections: Array.from(rooms.values()).reduce((sum, room) => sum + room.connections.size, 0),
      activeVideoCalls: videoCallRooms.size,
      uptime: process.uptime()
    }));
  } else if (req.url.startsWith('/api/chat/')) {
    handleRestAPI(req, res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = process.env.WS_PORT || 1234;

server.listen(PORT, () => {
  console.log(`Enhanced WebSocket server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`Chat API available at http://localhost:${PORT}/api/chat/`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket server...');
  
  wss.clients.forEach((ws) => {
    ws.close(1000, 'Server shutting down');
  });
  
  docs.forEach((doc, id) => {
    try {
      doc.destroy();
    } catch (error) {
      console.error(`Error destroying doc ${id}:`, error);
    }
  });
  docs.clear();
  
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    server.close(() => {
      console.log('WebSocket server shut down');
      process.exit(0);
    });
  });
});

module.exports = { server, wss, rooms, videoCallRooms };