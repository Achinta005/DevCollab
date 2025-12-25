import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageCircle,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Send,
  Smile,
  Paperclip,
  MoreVertical,
  Edit,
  Trash2,
  Reply,
  Users,
  Minimize2,
  Maximize2,
} from "lucide-react";

// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div>Something went wrong. Please refresh the page.</div>;
    }
    return this.props.children;
  }
}

const CommunicationComponent = ({
  projectId,
  userId,
  userName,
  token,
  wsUrl, // Will use this or fall back to env variable
}) => {
  // State management
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState([]);
  const [activeUsers, setActiveUsers] = useState(new Map());

  // Video call state
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callParticipants, setCallParticipants] = useState(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [currentCallId, setCurrentCallId] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  const [isPlayingLocally, setIsPlayingLocally] = useState(false);

  // UI state
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [isVideoMinimized, setIsVideoMinimized] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef(new Map());
  const peerConnections = useRef(new Map());
  const localStream = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const mounted = useRef(true);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // ICE servers configuration
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // WebSocket connection setup
  useEffect(() => {
    mounted.current = true;

    // Determine WebSocket URL: use prop, then env variable, then default
    const getWebSocketUrl = () => {
      if (wsUrl) return wsUrl;
      if (process.env.NEXT_PUBLIC_SOCKET_URL)
        return process.env.NEXT_PUBLIC_SOCKET_URL;
      return "ws://localhost:3001/api/chat"; // fallback
    };

    const connectWebSocket = () => {
      const baseUrl = getWebSocketUrl().replace(/\/$/, ""); // Remove trailing slash
      const wsUrl = `${baseUrl}/${projectId}?userId=${userId}&userName=${encodeURIComponent(
        userName
      )}&token=${token}&projectId=${projectId}`;

      console.log("🔌 Connecting to WebSocket:", wsUrl);

      const wsConnection = new WebSocket(wsUrl);

      wsConnection.onopen = () => {
        console.log("✅ WebSocket connected successfully");
        setIsConnected(true);
        setWs(wsConnection);
      };

      wsConnection.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
      };

      wsConnection.onmessage = (event) => {
        if (mounted.current) {
          handleWebSocketMessage(event);
        }
      };

      wsConnection.onclose = () => {
        if (mounted.current) {
          console.log("WebSocket disconnected");
          setIsConnected(false);
          setWs(null);
          setIsVideoCallActive(false);
          setIsInCall(false);
          setCurrentCallId(null);
          setCallParticipants(new Map());
          cleanupMediaStreams();
          setTimeout(connectWebSocket, 3000);
        }
      };
    };

    connectWebSocket();

    return () => {
      mounted.current = false;
      if (ws) {
        ws.close();
      }
      cleanupMediaStreams();
      peerConnections.current.forEach((pc, userId) => {
        console.log("Closing peer connection for:", userId);
        pc.close();
      });
      peerConnections.current.clear();
    };
  }, [projectId, userId, userName, token, wsUrl]);

  useEffect(() => {
    if (localVideoRef.current && localStream.current) {
      console.log("🔁 Re-attaching local stream to video element");
      localVideoRef.current.srcObject = localStream.current;

      localVideoRef.current
        .play()
        .then(() => setIsPlayingLocally(true))
        .catch(() => setIsPlayingLocally(false));
    }
  }, [isInCall]);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    setShowScrollDown(distanceFromBottom > 60);
  }, []);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    if (distanceFromBottom < 40) {
      setShowScrollDown(false);
    }
  }, [messages]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback(
    async (event) => {
      if (event.data instanceof Blob) {
        console.warn(
          "Received Blob data, handling not implemented:",
          event.data
        );
        return;
      }

      try {
        const data = JSON.parse(event.data);
        console.log("Received WebSocket message:", data.type, data);

        switch (data.type) {
          case "chat_history":
            setMessages(data.messages.reverse());
            break;
          case "chat_message":
            setMessages((prev) => [...prev, data.message]);
            break;
          case "user_joined":
            setActiveUsers(
              (prev) => new Map(prev.set(data.user.userId, data.user))
            );
            setMessages((prev) => [
              ...prev,
              {
                type: "system",
                content: `${data.user.userName} joined the chat`,
                timestamp: data.timestamp,
              },
            ]);
            break;
          case "user_left":
            setActiveUsers((prev) => {
              const newMap = new Map(prev);
              newMap.delete(data.user.userId);
              return newMap;
            });
            setMessages((prev) => [
              ...prev,
              {
                type: "system",
                content: `${data.user.userName} left the chat`,
                timestamp: data.timestamp,
              },
            ]);
            break;
          case "typing_start":
            setIsTyping((prev) => [
              ...prev.filter((u) => u.userId !== data.user.userId),
              data.user,
            ]);
            break;
          case "typing_stop":
            setIsTyping((prev) =>
              prev.filter((u) => u.userId !== data.user.userId)
            );
            break;
          case "video_call_started":
            console.log("Video call started, callId:", data.callId);
            setIsVideoCallActive(true);
            setCurrentCallId(data.callId);
            break;
          case "video_call_ended":
            setIsVideoCallActive(false);
            setIsInCall(false);
            setCurrentCallId(null);
            setCallParticipants(new Map());
            cleanupMediaStreams();
            break;
          case "video_call_offer":
            console.log("Received offer from:", data.fromUser.userId);
            await handleVideoCallOffer(data);
            break;
          case "video_call_answer":
            console.log("Received answer from:", data.fromUser.userId);
            await handleVideoCallAnswer(data);
            break;
          case "video_call_ice_candidate":
            console.log("Received ICE candidate from:", data.fromUser.userId);
            await handleVideoCallIceCandidate(data);
            break;
          case "video_call_user_joined":
            console.log("User joined call:", data.user.userId);
            setCallParticipants(
              (prev) => new Map(prev.set(data.user.userId, data.user))
            );
            if (isInCall && data.user.userId !== userId) {
              setTimeout(() => sendVideoCallOffer(data.user.userId), 1000);
            }
            break;
          case "video_call_user_left":
            handleVideoCallUserLeft(data);
            break;
          case "message_reaction":
            updateMessageReactions(data);
            break;
          case "message_edited":
            updateMessage(data.message);
            break;
          case "message_deleted":
            removeMessage(data.messageId);
            break;
          default:
            console.log("Unknown message type:", data.type);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    },
    [isInCall, userId, currentCallId]
  );

  // Create peer connection with proper event handlers
  const createPeerConnection = (targetUserId) => {
    console.log("Creating peer connection for:", targetUserId);

    const existingConnection = peerConnections.current.get(targetUserId);
    if (existingConnection) {
      existingConnection.close();
    }

    const peerConnection = new RTCPeerConnection({ iceServers });

    if (localStream.current) {
      console.log("Adding local stream tracks to peer connection");
      localStream.current.getTracks().forEach((track) => {
        console.log("Adding track:", track.kind, track.enabled);
        peerConnection.addTrack(track, localStream.current);
      });
    }

    peerConnection.ontrack = (event) => {
      console.log(
        "Received remote track from:",
        targetUserId,
        event.streams[0]
      );
      const remoteVideo = document.getElementById(
        `remote-video-${targetUserId}`
      );
      if (remoteVideo && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
        remoteVideosRef.current.set(targetUserId, {
          video: remoteVideo,
          needsPlay: true,
        });
        remoteVideo.play().catch((err) => {
          console.warn("Remote video autoplay failed:", err);
          remoteVideosRef.current.set(targetUserId, {
            video: remoteVideo,
            needsPlay: true,
          });
        });
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE candidate to:", targetUserId);
        sendWebSocketMessage({
          type: "video_call_ice_candidate",
          candidate: event.candidate,
          callId: currentCallId,
          targetUserId: targetUserId,
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(
        `Connection state for ${targetUserId}:`,
        peerConnection.connectionState
      );
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(
        `ICE connection state for ${targetUserId}:`,
        peerConnection.iceConnectionState
      );
    };

    peerConnections.current.set(targetUserId, peerConnection);
    return peerConnection;
  };

  const sendVideoCallOffer = async (targetUserId) => {
    try {
      console.log("Sending offer to:", targetUserId);
      const peerConnection = createPeerConnection(targetUserId);

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnection.setLocalDescription(offer);
      console.log("Local description set for offer to:", targetUserId);

      sendWebSocketMessage({
        type: "video_call_offer",
        offer: offer,
        callId: currentCallId,
        targetUserId: targetUserId,
      });
    } catch (error) {
      console.error("Error sending offer:", error);
    }
  };

  // Video call handlers
  const handleVideoCallOffer = async (data) => {
    if (!isInCall) {
      console.log("Not in call, ignoring offer");
      return;
    }

    try {
      console.log("Handling video call offer from:", data.fromUser.userId);
      const peerConnection = createPeerConnection(data.fromUser.userId);

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );
      console.log(
        "Remote description set for offer from:",
        data.fromUser.userId
      );

      const answer = await peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnection.setLocalDescription(answer);
      console.log("Local description set for answer to:", data.fromUser.userId);

      sendWebSocketMessage({
        type: "video_call_answer",
        answer: answer,
        callId: data.callId,
        targetUserId: data.fromUser.userId,
      });
    } catch (error) {
      console.error("Error handling video call offer:", error);
    }
  };

  const handleVideoCallAnswer = async (data) => {
    try {
      console.log("Handling video call answer from:", data.fromUser.userId);
      const peerConnection = peerConnections.current.get(data.fromUser.userId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        console.log(
          "Remote description set for answer from:",
          data.fromUser.userId
        );
      } else {
        console.error("No peer connection found for:", data.fromUser.userId);
      }
    } catch (error) {
      console.error("Error handling video call answer:", error);
    }
  };

  const handleVideoCallIceCandidate = async (data) => {
    try {
      console.log("Handling ICE candidate from:", data.fromUser.userId);
      const peerConnection = peerConnections.current.get(data.fromUser.userId);
      if (peerConnection && peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
        console.log("ICE candidate added for:", data.fromUser.userId);
      } else {
        console.warn(
          "Cannot add ICE candidate - no peer connection or remote description for:",
          data.fromUser.userId
        );
      }
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  };

  const handleVideoCallUserLeft = (data) => {
    console.log("User left call:", data.user.userId);
    setCallParticipants((prev) => {
      const newMap = new Map(prev);
      newMap.delete(data.user.userId);
      return newMap;
    });

    const peerConnection = peerConnections.current.get(data.user.userId);
    if (peerConnection) {
      peerConnection.close();
      peerConnections.current.delete(data.user.userId);
    }

    remoteVideosRef.current.delete(data.user.userId);
  };

  // Initialize media stream with proper constraints
  const initializeMediaStream = async () => {
    console.log("localVideoRef at init:", localVideoRef.current);

    try {
      console.log("Attempting to initialize media stream...");

      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        video: isVideoEnabled
          ? {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 },
            }
          : false,
        audio: isAudioEnabled
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log(
        "Media stream initialized with tracks:",
        stream.getTracks().map((t) => `${t.kind}: ${t.enabled}`)
      );

      localStream.current = stream;
      setMediaError(null);

      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;

        try {
          await localVideoRef.current.play();
          setIsPlayingLocally(true);
          console.log("Local video playing");
        } catch (playError) {
          console.warn("Local video autoplay failed:", playError);
          setIsPlayingLocally(false);
        }
      }

      return stream;
    } catch (error) {
      console.error(
        "Error accessing media devices:",
        error.name,
        error.message
      );
      const errorMessage =
        error.name === "NotAllowedError"
          ? "Camera/microphone access denied. Please allow permissions and refresh."
          : error.name === "NotFoundError"
          ? "No camera/microphone found. Please check your devices."
          : `Failed to access media: ${error.message}`;

      setMediaError(errorMessage);
      throw error;
    }
  };

  const cleanupMediaStreams = () => {
    console.log("Cleaning up media streams");

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        track.stop();
        console.log("Stopped track:", track.kind);
      });
      localStream.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    peerConnections.current.forEach((pc, userId) => {
      console.log("Closing peer connection for:", userId);
      pc.close();
    });
    peerConnections.current.clear();

    remoteVideosRef.current.forEach((video, userId) => {
      if (video) {
        video.srcObject = null;
      }
    });
    remoteVideosRef.current.clear();

    setIsPlayingLocally(false);
  };

  // Chat functions
  const sendMessage = () => {
    if (!newMessage.trim() || !ws || newMessage.length > 1000) {
      if (newMessage.length > 1000) {
        alert("Message is too long (max 1000 characters)");
      }
      return;
    }

    const messageData = {
      type: "chat_message",
      content: newMessage,
      replyTo: replyingTo?._id,
    };
    console.log(messageData);
    sendWebSocketMessage(messageData);
    setNewMessage("");
    setReplyingTo(null);
    stopTyping();
  };

  const startTyping = () => {
    sendWebSocketMessage({ type: "typing_start" });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(stopTyping, 3000);
  };

  const stopTyping = () => {
    sendWebSocketMessage({ type: "typing_stop" });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (e.target.value && !typingTimeoutRef.current) {
      startTyping();
    } else if (!e.target.value) {
      stopTyping();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // File upload handler (modified to use base64)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !ws) {
      console.warn("No file selected or WebSocket not connected");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      // Limit to 5MB
      alert("File is too large (max 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result.split(",")[1]; // Remove data URL prefix
      sendWebSocketMessage({
        type: "file_upload",
        fileName: file.name,
        fileType: file.type,
        fileData: base64Data,
      });
      console.log("File sent:", file.name);
    };
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      alert("Failed to read file");
    };
    reader.readAsDataURL(file);
  };

  // Video call functions
  const startVideoCall = async () => {
    try {
      console.log("Starting video call...");
      await initializeMediaStream();

      sendWebSocketMessage({ type: "video_call_start" });
      setIsInCall(true);

      console.log("Video call started, waiting for participants...");
    } catch (error) {
      console.error("Error starting video call:", error);
      alert(
        mediaError ||
          "Could not start video call. Please check your camera and microphone permissions."
      );
    }
  };

  const joinVideoCall = async () => {
    try {
      console.log("Joining video call...");
      await initializeMediaStream();

      sendWebSocketMessage({
        type: "video_call_join",
        callId: currentCallId,
      });
      setIsInCall(true);

      console.log("Joined video call");
    } catch (error) {
      console.error("Error joining video call:", error);
      alert(
        mediaError ||
          "Could not join video call. Please check your camera and microphone permissions."
      );
    }
  };

  const leaveVideoCall = () => {
    console.log("Leaving video call");
    sendWebSocketMessage({
      type: "video_call_leave",
      callId: currentCallId,
    });
    setIsInCall(false);
    cleanupMediaStreams();
  };

  const endVideoCall = () => {
    console.log("Ending video call");
    sendWebSocketMessage({
      type: "video_call_end",
      callId: currentCallId,
    });
    setIsInCall(false);
    cleanupMediaStreams();
  };

  const toggleVideo = async () => {
    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log("Video toggled:", videoTrack.enabled);
      }
    } else if (!isVideoEnabled) {
      try {
        setIsVideoEnabled(true);
        await initializeMediaStream();
      } catch (error) {
        console.error("Error enabling video:", error);
        setIsVideoEnabled(false);
      }
    }
  };

  const toggleAudio = async () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        console.log("Audio toggled:", audioTrack.enabled);
      }
    } else if (!isAudioEnabled) {
      try {
        setIsAudioEnabled(true);
        await initializeMediaStream();
      } catch (error) {
        console.error("Error enabling audio:", error);
        setIsAudioEnabled(false);
      }
    }
  };

  const playLocalVideo = () => {
    if (localVideoRef.current && localStream.current && !isPlayingLocally) {
      localVideoRef.current
        .play()
        .then(() => {
          console.log("Local video started playing manually");
          setIsPlayingLocally(true);
        })
        .catch((err) => {
          console.error("Manual play failed:", err);
          setMediaError(
            "Failed to play video. Try refreshing or checking permissions."
          );
        });
    }
  };

  const playRemoteVideo = (participantId) => {
    const videoData = remoteVideosRef.current.get(participantId);
    if (videoData?.video && videoData.needsPlay) {
      videoData.video
        .play()
        .then(() => {
          console.log(
            `Remote video for ${participantId} started playing manually`
          );
          remoteVideosRef.current.set(participantId, {
            video: videoData.video,
            needsPlay: false,
          });
        })
        .catch((err) => {
          console.error(`Manual play failed for ${participantId}:`, err);
        });
    }
  };

  // Message functions
  const addReaction = (messageId, emoji) => {
    sendWebSocketMessage({
      type: "message_reaction",
      messageId,
      emoji,
      action: "add",
    });
  };

  const editMessage = (messageId, newContent) => {
    if (newContent.length > 1000) {
      alert("Message is too long (max 1000 characters)");
      return;
    }
    sendWebSocketMessage({
      type: "message_edit",
      messageId,
      newContent,
    });
    setEditingMessage(null);
  };

  const deleteMessage = (messageId) => {
    sendWebSocketMessage({
      type: "message_delete",
      messageId,
    });
  };

  const replyToMessage = (message) => {
    setReplyingTo(message);
    document.getElementById("message-input")?.focus();
  };

  // Helper functions
  const sendWebSocketMessage = (data) => {
    console.log("📤 Sending WS message to backend:", data);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      console.log("✅ WS send() executed");
    } else {
      console.warn("❌ WebSocket not connected", {
        wsExists: !!ws,
        readyState: ws?.readyState,
        data,
      });
    }
  };

  const updateMessageReactions = (data) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === data.messageId ? { ...msg, reactions: data.reactions } : msg
      )
    );
  };

  const updateMessage = (updatedMessage) => {
    setMessages((prev) =>
      prev.map((msg) => (msg._id === updatedMessage._id ? updatedMessage : msg))
    );
  };

  const removeMessage = (messageId) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === messageId
          ? { ...msg, deleted: true, content: "[Message deleted]" }
          : msg
      )
    );
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  // Rest of your JSX remains the same...

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-gray-900 text-white">
        {/* Chat Section */}
        <div
          className={`relative flex flex-col bg-gray-800 border-r border-gray-700 transition-all duration-300 ${
            isChatMinimized ? "w-16" : "w-96"
          }`}
        >
          {/* Chat Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            {!isChatMinimized && (
              <>
                <div className="flex items-center space-x-2">
                  <MessageCircle className="w-5 h-5" />
                  <span className="font-medium">Chat</span>
                  <div className="flex items-center space-x-1">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isConnected ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <span className="text-xs text-gray-400">
                      {activeUsers.size} online
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatMinimized(true)}
                  className="p-1 hover:bg-gray-700 rounded"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </>
            )}
            {isChatMinimized && (
              <button
                onClick={() => setIsChatMinimized(false)}
                className="p-2 hover:bg-gray-700 rounded w-full"
              >
                <MessageCircle className="w-5 h-5 mx-auto" />
              </button>
            )}
          </div>

          {!isChatMinimized && (
            <>
              {/* Messages */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {messages.map((message, index) => {
                  const showDate =
                    index === 0 ||
                    formatDate(messages[index - 1]?.timestamp) !==
                      formatDate(message.timestamp);

                  return (
                    <div key={message._id || index}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="text-xs bg-gray-700 px-3 py-1 rounded-full">
                            {formatDate(message.timestamp)}
                          </span>
                        </div>
                      )}

                      {message.type === "system" ? (
                        <div className="text-center text-gray-400 text-sm">
                          {message.content}
                        </div>
                      ) : (
                        <div
                          className={`flex ${
                            message.sender?.userId === userId
                              ? "justify-end"
                              : "justify-start"
                          } group`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              message.sender?.userId === userId
                                ? "bg-blue-600 text-white"
                                : "bg-gray-700 text-white"
                            } ${message.deleted ? "opacity-60 italic" : ""}`}
                          >
                            {message.replyTo && (
                              <div className="text-xs opacity-70 mb-1 pl-2 border-l-2 border-gray-500">
                                Replying to:{" "}
                                {message.replyTo.content.substring(0, 50)}...
                              </div>
                            )}

                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                {message.sender?.userId !== userId && (
                                  <p className="text-xs font-medium mb-1">
                                    {message.sender?.userName}
                                  </p>
                                )}
                                <p className="text-sm">{message.content}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs opacity-70">
                                {formatTime(message.timestamp)}
                                {message.edited && " (edited)"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {isTyping.length > 0 && (
                  <div className="text-sm text-gray-400">
                    {isTyping.map((user) => user.userName).join(", ")}
                    {isTyping.length === 1 ? " is" : " are"} typing...
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Reply indicator */}
              {replyingTo && (
                <div className="px-4 py-2 bg-gray-700 border-b border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-gray-400">Replying to </span>
                      <span className="font-medium">
                        {replyingTo.sender.userName}
                      </span>
                      <p className="text-xs text-gray-500 truncate">
                        {replyingTo.content}
                      </p>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {/* Message Input */}
              <div className="p-4 border-t border-gray-700">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 hover:bg-gray-700 rounded"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <div className="flex-1 relative">
                    <input
                      id="message-input"
                      type="text"
                      value={newMessage}
                      onChange={handleInputChange}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!isConnected}
                    />
                  </div>

                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || !isConnected}
                    className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </>
          )}
          {showScrollDown && !isChatMinimized && (
  <button
    onClick={() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setShowScrollDown(false);
    }}
    title="Jump to latest"
    className="
      absolute
      bottom-28  
      right-4
      z-30

      w-11 h-11
      rounded-full
      flex items-center justify-center

      bg-gray-900/50
      backdrop-blur
      border border-gray-700

      shadow-xl shadow-black/40
      hover:bg-blue-600
      hover:border-blue-500
      hover:scale-110
      active:scale-95

      transition-all duration-200 ease-out
    "
  >
    <span className="text-lg leading-none">↓</span>
  </button>
)}

        </div>

        {/* Video Section */}
        <div className="flex-1 flex flex-col">
          {/* Video Controls Header */}
          <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center space-x-4">
              <Video className="w-5 h-5" />
              <span className="font-medium">Video Conference</span>
              {isVideoCallActive && (
                <span className="text-sm text-green-400">
                  Call active • {callParticipants.size + (isInCall ? 1 : 0)}{" "}
                  participants
                </span>
              )}
              {mediaError && (
                <span className="text-sm text-red-400 max-w-md truncate">
                  {mediaError}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {!isVideoCallActive && !isInCall && (
                <button
                  onClick={startVideoCall}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg disabled:bg-gray-600"
                  disabled={!isConnected}
                >
                  <Video className="w-4 h-4" />
                  <span>Start Call</span>
                </button>
              )}

              {isVideoCallActive && !isInCall && (
                <button
                  onClick={joinVideoCall}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  <Video className="w-4 h-4" />
                  <span>Join Call</span>
                </button>
              )}

              {isInCall && (
                <>
                  <button
                    onClick={toggleAudio}
                    className={`p-2 rounded-full ${
                      isAudioEnabled
                        ? "bg-gray-600 hover:bg-gray-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                    title={
                      isAudioEnabled ? "Mute microphone" : "Unmute microphone"
                    }
                  >
                    {isAudioEnabled ? (
                      <Mic className="w-4 h-4" />
                    ) : (
                      <MicOff className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={toggleVideo}
                    className={`p-2 rounded-full ${
                      isVideoEnabled
                        ? "bg-gray-600 hover:bg-gray-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                    title={
                      isVideoEnabled ? "Turn off camera" : "Turn on camera"
                    }
                  >
                    {isVideoEnabled ? (
                      <Video className="w-4 h-4" />
                    ) : (
                      <VideoOff className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={leaveVideoCall}
                    className="p-2 bg-red-600 hover:bg-red-700 rounded-full"
                    title="Leave call"
                  >
                    <PhoneOff className="w-4 h-4" />
                  </button>

                  <button
                    onClick={endVideoCall}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
                    title="End call for everyone"
                  >
                    End Call
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Video Area */}
          <div className="flex-1 bg-black relative overflow-hidden">
            {!isInCall && !isVideoCallActive ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Video className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-medium mb-2">
                    No active video call
                  </h3>
                  <p className="text-gray-400">
                    Start a call to begin video conferencing
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-2 h-full">
                  {/* Local Video */}
                  {isInCall && (
                    <div className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[200px] flex items-center justify-center">
                      {localStream.current ? (
                        <>
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className={`w-full h-full object-cover ${
                              !isVideoEnabled ? "hidden" : ""
                            }`}
                          />
                          {!isVideoEnabled && (
                            <div className="flex items-center justify-center w-full h-full bg-gray-700">
                              <VideoOff className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                          {!isPlayingLocally && isVideoEnabled && (
                            <button
                              onClick={playLocalVideo}
                              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 p-3 rounded-full"
                              title="Click to start video"
                            >
                              <Video className="w-6 h-6" />
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-center w-full h-full bg-gray-700">
                          <div className="text-center">
                            <Video className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm text-gray-400">
                              Initializing camera...
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-sm">
                        You {!isVideoEnabled && "(Video Off)"}
                      </div>

                      {!isAudioEnabled && (
                        <div className="absolute top-2 right-2 bg-red-600 p-1 rounded-full">
                          <MicOff className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Remote Videos */}
                  {Array.from(callParticipants.entries()).map(
                    ([participantId, participant]) =>
                      participantId !== userId && (
                        <div
                          key={participantId}
                          className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[200px] flex items-center justify-center"
                        >
                          <video
                            id={`remote-video-${participantId}`}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          {remoteVideosRef.current.get(participantId)
                            ?.needsPlay && (
                            <button
                              onClick={() => playRemoteVideo(participantId)}
                              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 p-3 rounded-full"
                              title={`Start video for ${participant.userName}`}
                            >
                              <Video className="w-6 h-6" />
                            </button>
                          )}
                          <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-sm">
                            {participant.userName}
                          </div>

                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center opacity-50">
                              <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                              <p className="text-sm text-gray-400">
                                {participant.userName}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                  )}

                  {/* Placeholder for waiting participants */}
                  {isVideoCallActive && !isInCall && (
                    <div className="flex items-center justify-center bg-gray-800 rounded-lg min-h-[200px]">
                      <div className="text-center">
                        <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-400">
                          Waiting to join...
                        </p>
                        <button
                          onClick={joinVideoCall}
                          className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                        >
                          Join Call
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Show connection status for debugging */}
                  {isInCall && (
                    <div className="absolute top-4 right-4 bg-black bg-opacity-75 px-3 py-2 rounded text-xs">
                      <div>WebSocket: {isConnected ? "✓" : "✗"}</div>
                      <div>Local Stream: {localStream.current ? "✓" : "✗"}</div>
                      <div>
                        Peer Connections: {peerConnections.current.size}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit Message Modal */}
        {editingMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg w-96">
              <h3 className="text-lg font-medium mb-4">Edit Message</h3>
              <textarea
                value={editingMessage.content}
                onChange={(e) =>
                  setEditingMessage({
                    ...editingMessage,
                    content: e.target.value,
                  })
                }
                className="w-full p-3 bg-gray-700 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
              />
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setEditingMessage(null)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    editMessage(editingMessage._id, editingMessage.content)
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default CommunicationComponent;
