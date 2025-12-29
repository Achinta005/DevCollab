"use client";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Users,
  MessageSquare,
  Reply,
  Smile,
  MoreVertical,
  Trash2,
  Edit2,
  Copy,
  X,
} from "lucide-react";

export default function Communication({ projectId, userId, userName }) {
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);

  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [activeUsers, setActiveUsers] = useState([]);

  const [activeTab, setActiveTab] = useState("chat");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);

  const ICE_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  // ============ LOAD INITIAL MESSAGES ============
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/messages`,
          { credentials: "include" }
        );
        if (response.ok) {
          const data = await response.json();
          console.log("DTA", data);
          setMessages(data);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setLoading(false);
      }
    };
    loadMessages();
  }, [projectId]);

  // ============ SOCKET.IO SETUP ============
  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_API_URL}/ws/communication`, {
      query: { projectId, userId, userName },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket.IO connected");
    });

    socket.on("chat_message", (msg) => {
      console.log("📩 SERVER → CLIENT (chat_message):", msg);
      console.log("🔑 MESSAGE KEYS:", Object.keys(msg));
      console.log("📝 msg.content:", msg.content);
      console.log("📝 msg.message:", msg.message);

      setMessages((prev) => [...prev, msg]);
    });

    socket.on("message_edited", (data) => {
      setMessages((prev) =>
        prev.map((msg) => (msg._id === data._id ? { ...msg, ...data } : msg))
      );
    });

    socket.on("message_deleted", (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, deleted: true, content: "Message deleted" }
            : msg
        )
      );
    });

    socket.on("typing_start", (data) => {
      if (data.userName !== userName) {
        setTypingUsers((prev) =>
          prev.includes(data.userName) ? prev : [...prev, data.userName]
        );
      }
    });

    socket.on("typing_stop", (data) => {
      setTypingUsers((prev) => prev.filter((u) => u !== data.userName));
    });

    socket.on("user_joined", (data) => {
      setActiveUsers((prev) => {
        const exists = prev.find((u) => u.userId === data.userId);
        if (!exists) {
          return [...prev, data];
        }
        return prev;
      });
      setMessages((prev) => [
        ...prev,
        {
          type: "user_joined",
          sender: { userName: data.userName },
          content: `${data.userName} joined the project`,
          timestamp: Date.now(),
        },
      ]);
    });

    socket.on("user_left", (data) => {
      setActiveUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      cleanupPeerConnection(data.userId);
      setMessages((prev) => [
        ...prev,
        {
          type: "user_left",
          sender: { userName: data.userName },
          content: `${data.userName} left the project`,
          timestamp: Date.now(),
        },
      ]);
    });

    // ============ VIDEO SIGNALING ============
    socket.on("video_offer", async ({ offer, from }) => {
      await handleVideoOffer(offer, from);
    });

    socket.on("video_answer", async ({ answer, from }) => {
      const pc = peerConnectionsRef.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on("video_ice_candidate", async ({ candidate, from }) => {
      const pc = peerConnectionsRef.current[from];
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on("disconnect", () => {
      console.warn("❌ Socket.IO disconnected");
    });

    return () => {
      stopMediaStream();
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      socket.disconnect();
    };
  }, [projectId, userId, userName]);

  // ============ CHAT FUNCTIONS ============
  const sendMessage = () => {
    if (!messageInput.trim()) return;

    const messageData = {
      projectId,
      message: messageInput,
      userId,
      userName,
      type: "text",
      replyTo: replyingTo?._id || null,
    };
    console.log("📤 SENDING MESSAGE:", messageData);
    if (editingMessage) {
      socketRef.current.emit("edit_message", {
        messageId: editingMessage._id,
        content: messageInput,
      });
      setEditingMessage(null);
    } else {
      socketRef.current.emit("chat_message", messageData);
    }

    setMessageInput("");
    setReplyingTo(null);
    stopTyping();
  };

  const deleteMessage = (messageId) => {
    socketRef.current.emit("delete_message", { messageId, projectId });
  };

  const startTyping = () => {
    socketRef.current.emit("typing_start", { projectId, userName });

    if (typingTimeout) clearTimeout(typingTimeout);

    const timeout = setTimeout(() => {
      stopTyping();
    }, 3000);

    setTypingTimeout(timeout);
  };

  const stopTyping = () => {
    socketRef.current.emit("typing_stop", { projectId, userName });
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      setTypingTimeout(null);
    }
  };

  // ============ VIDEO FUNCTIONS ============
  const startMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setIsVideoEnabled(true);
      setIsAudioEnabled(true);

      // Broadcast video call start
      socketRef.current.emit("video_call_start", { projectId, userName });

      activeUsers.forEach((user) => {
        if (user.userId !== userId) {
          createPeerConnection(user.userId);
        }
      });
    } catch (err) {
      console.error("Failed to get media stream:", err);
      alert("Failed to access camera/microphone. Please check permissions.");
    }
  };

  const stopMediaStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    peerConnectionsRef.current = {};

    socketRef.current.emit("video_call_end", { projectId, userName });

    setIsVideoEnabled(false);
    setIsAudioEnabled(false);
    setRemoteStreams({});
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const createPeerConnection = async (remoteUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[remoteUserId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [remoteUserId]: event.streams[0],
      }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("video_ice_candidate", {
          projectId,
          candidate: event.candidate,
          to: remoteUserId,
          from: userId,
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current.emit("video_offer", {
      projectId,
      offer,
      to: remoteUserId,
      from: userId,
    });

    return pc;
  };

  const handleVideoOffer = async (offer, fromUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[fromUserId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [fromUserId]: event.streams[0],
      }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("video_ice_candidate", {
          projectId,
          candidate: event.candidate,
          to: fromUserId,
          from: userId,
        });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current.emit("video_answer", {
      projectId,
      answer,
      to: fromUserId,
      from: userId,
    });
  };

  const cleanupPeerConnection = (remoteUserId) => {
    const pc = peerConnectionsRef.current[remoteUserId];
    if (pc) {
      pc.close();
      delete peerConnectionsRef.current[remoteUserId];
    }
    setRemoteStreams((prev) => {
      const newStreams = { ...prev };
      delete newStreams[remoteUserId];
      return newStreams;
    });
  };

  useEffect(() => {
    if (activeTab === "chat") {
      setUnreadMessages(0);
    }
  }, [activeTab]);

  const renderMessage = (msg, i) => {
    const isOwn = msg.sender?.userId === userId;
    const isSystem = [
      "user_joined",
      "user_left",
      "video_call_start",
      "video_call_end",
    ].includes(msg.type);

    if (isSystem) {
      return (
        <div key={i} className="flex justify-center my-2">
          <div className="px-3 py-1 rounded-full bg-[#3d2a1a] text-[#d4a574] text-xs">
            {msg.content}
          </div>
        </div>
      );
    }

    if (msg.deleted) {
      return (
        <div key={i} className="flex justify-start">
          <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-[#3d2a1a] text-[#8b7355] italic">
            <p className="text-sm">Message deleted</p>
          </div>
        </div>
      );
    }

    return (
      <div
        key={i}
        className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}
      >
        <div
          className={`max-w-xs lg:max-w-md relative ${
            isOwn ? "order-2" : "order-1"
          }`}
        >
          {msg.replyTo && (
            <div className="mb-1 px-3 py-1 bg-amber-800/40 rounded text-xs text-amber-300 border-l-2 border-amber-500">
              Replying to message
            </div>
          )}
          <div
            className={`px-4 py-2 rounded-lg ${
              isOwn
                ? "bg-amber-600 text-amber-50"
                : "bg-amber-800/50 text-amber-100 border border-amber-600/30"
            }`}
          >
            {!isOwn && (
              <p className="text-xs font-semibold mb-1 text-amber-300">
                {msg.sender?.userName}
              </p>
            )}
            <p className="text-sm break-words">{msg.content ?? msg.message}</p>

            <div className="flex items-center justify-between mt-1 gap-2">
              <p
                className={`text-xs ${
                  isOwn ? "text-amber-100 opacity-70" : "text-amber-300"
                }`}
              >
                {new Date(msg.createdAt || msg.timestamp).toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}
                {msg.edited && " (edited)"}
              </p>
            </div>
          </div>

          {isOwn && !msg.deleted && (
            <div className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  setEditingMessage(msg);
                  setMessageInput(msg.content ?? msg.message ?? "");
                }}
                className="p-1 hover:bg-amber-800/50 rounded"
              >
                <Edit2 className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          )}
        </div>

        {!isOwn && (
          <div
            className={`opacity-0 group-hover:opacity-100 transition-opacity ${
              isOwn ? "order-1 mr-2" : "order-2 ml-2"
            }`}
          >
            <button
              onClick={() => setReplyingTo(msg)}
              className="p-1 hover:bg-amber-800/50 rounded"
            >
              <Reply className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-amber-900/20 to-amber-800/20 backdrop-blur-sm border border-amber-700/30 shadow-lg rounded-lg m-5">
      {/* Header */}
      <div className="bg-amber-800/40 border-b border-amber-600/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-amber-100">
              Project Communication
            </h2>
            <p className="text-sm text-amber-200/80 mt-1">
              {activeUsers.length} {activeUsers.length === 1 ? "user" : "users"}{" "}
              online
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("chat")}
              className={`relative px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                activeTab === "chat"
                  ? "bg-amber-700/70 text-amber-100"
                  : "bg-amber-800/40 text-amber-300 hover:bg-amber-800/60"
              }`}
            >
              <MessageSquare className="inline-block w-4 h-4 mr-2" />
              Chat
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadMessages}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("video")}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                activeTab === "video"
                  ? "bg-amber-700/70 text-amber-100"
                  : "bg-amber-800/40 text-amber-300 hover:bg-amber-800/60"
              }`}
            >
              <Video className="inline-block w-4 h-4 mr-2" />
              Video
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                activeTab === "users"
                  ? "bg-amber-700/70 text-amber-100"
                  : "bg-amber-800/40 text-amber-300 hover:bg-amber-800/60"
              }`}
            >
              <Users className="inline-block w-4 h-4 mr-2" />
              Users
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* CHAT TAB */}
        {activeTab === "chat" && (
          <div className="flex flex-col h-full">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {loading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="text-amber-300">Loading messages...</div>
                </div>
              ) : (
                messages.map((msg, i) => renderMessage(msg, i))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
              <div className="px-6 py-2 text-sm text-amber-300 italic">
                {typingUsers.join(", ")}{" "}
                {typingUsers.length === 1 ? "is" : "are"} typing...
              </div>
            )}

            {/* Reply/Edit Banner */}
            {(replyingTo || editingMessage) && (
              <div className="px-6 py-2 bg-amber-800/40 border-t border-amber-600/30 flex items-center justify-between">
                <div className="text-sm text-amber-200">
                  {editingMessage
                    ? "Editing message"
                    : `Replying to ${replyingTo.sender?.userName}`}
                </div>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setEditingMessage(null);
                    setMessageInput("");
                  }}
                  className="text-amber-400 hover:text-amber-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Message Input */}
            <div className="border-t border-amber-600/30 bg-amber-800/40 px-6 py-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    startTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      sendMessage();
                    } else if (e.key === "Escape") {
                      setReplyingTo(null);
                      setEditingMessage(null);
                      setMessageInput("");
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-amber-700/20 border border-amber-600/30 rounded-lg text-amber-100 placeholder-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={sendMessage}
                  className="px-4 py-2 bg-amber-700/70 text-amber-100 rounded-lg hover:bg-amber-700/90 transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIDEO TAB */}
        {activeTab === "video" && (
          <div className="h-full p-6">
            <div className="h-full flex flex-col gap-4">
              {/* Video Grid */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Local Video */}
                <div className="relative bg-amber-900/30 rounded-lg overflow-hidden border border-amber-600/30">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-amber-800/80 text-amber-100 px-2 py-1 rounded text-sm border border-amber-600/30">
                    You {!isVideoEnabled && "(Camera Off)"}
                  </div>
                </div>

                {/* Remote Videos */}
                {Object.entries(remoteStreams).map(([remoteUserId, stream]) => (
                  <RemoteVideo
                    key={remoteUserId}
                    stream={stream}
                    userId={remoteUserId}
                  />
                ))}
              </div>

              {/* Video Controls */}
              <div className="flex justify-center gap-4">
                {!isVideoEnabled && !isAudioEnabled ? (
                  <button
                    onClick={startMediaStream}
                    className="px-6 py-3 bg-green-600/80 text-white rounded-lg hover:bg-green-600 transition-all font-medium shadow-lg"
                  >
                    <Video className="inline-block w-5 h-5 mr-2" />
                    Start Video Call
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggleVideo}
                      className={`p-4 rounded-full transition-all ${
                        isVideoEnabled
                          ? "bg-amber-700/70 text-amber-100 hover:bg-amber-700/90"
                          : "bg-red-600/80 text-white hover:bg-red-600"
                      }`}
                    >
                      {isVideoEnabled ? (
                        <Video className="w-6 h-6" />
                      ) : (
                        <VideoOff className="w-6 h-6" />
                      )}
                    </button>

                    <button
                      onClick={toggleAudio}
                      className={`p-4 rounded-full transition-all ${
                        isAudioEnabled
                          ? "bg-amber-700/70 text-amber-100 hover:bg-amber-700/90"
                          : "bg-red-600/80 text-white hover:bg-red-600"
                      }`}
                    >
                      {isAudioEnabled ? (
                        <Mic className="w-6 h-6" />
                      ) : (
                        <MicOff className="w-6 h-6" />
                      )}
                    </button>

                    <button
                      onClick={stopMediaStream}
                      className="p-4 rounded-full bg-red-600/80 text-white hover:bg-red-600 transition-all"
                    >
                      <PhoneOff className="w-6 h-6" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-amber-100 mb-4">
              Active Users
            </h3>
            <div className="space-y-2">
              {activeUsers.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center gap-3 p-3 bg-amber-800/40 rounded-lg border border-amber-600/30 hover:bg-amber-800/60 transition-colors"
                >
                  <div className="w-10 h-10 bg-amber-600 text-amber-100 rounded-full flex items-center justify-center font-semibold">
                    {user.userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-amber-100">
                      {user.userName}
                    </p>
                    <p className="text-sm text-amber-300">
                      {user.userId === userId ? "(You)" : "Active"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RemoteVideo({ stream, userId }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-amber-900/30 rounded-lg overflow-hidden border border-amber-600/30">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-amber-800/80 text-amber-100 px-2 py-1 rounded text-sm border border-amber-600/30">
        User {userId.slice(0, 8)}
      </div>
    </div>
  );
}
