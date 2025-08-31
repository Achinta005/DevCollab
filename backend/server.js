const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const cors = require("cors");
const connectDB = require("./config/db");
const http = require('http');
const { WebSocketServer } = require('ws');
const { setupWSConnection } = require('y-websocket');
const Project=require('./models/Project');
const File = require('./models/Projectfiles');
const authMiddleware=require('./middleware/auth')

const app = express();
// app.use(authMiddleware)
const port = process.env.PORT || 3001;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://dev-collab-git-main-achinta-hazras-projects.vercel.app",
      "https://dev-collab-ten.vercel.app",
    ],
    methods: ["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

// Apply express.json() selectively, excluding /files and /api/image/upload
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/files") || req.originalUrl === "/api/image/upload") {
    return next();
  }
  express.json({ limit: "10mb" })(req, res, next);
});

// Apply express.urlencoded() selectively, excluding /files and /api/image/upload
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/files") || req.originalUrl === "/api/image/upload") {
    return next();
  }
  express.urlencoded({ extended: true, limit: "10mb" })(req, res, next);
});

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Welcome to DevCollab!" });
});

app.get("/connect", (req, res) => {
  console.log("\nFrontend Is Connected\n");
  res.json({
    message: "Backend connected successfully",
    timestamp: new Date().toISOString(),
    status: "success",
  });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/reset", require("./routes/ResetPassword"));
app.use("/api/get", require("./routes/getProfilePic"));
app.use("/api/image", require("./routes/Profile-pic"));
app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/files", require("./routes/projectFiles"));
app.use('/editor',require('./routes/CodeEditor'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});



// WebSocket connection for real-time editing
wss.on('connection', async (ws, req) => {
  const [projectId, fileId] = req.url?.slice(1).split('_') || [];
  const roomId = `${projectId}_${fileId}`;
  const params = new URLSearchParams(req.url.split('?')[1]);
  const token = params.get('token');
  const userId = params.get('userId');

  if (!projectId || !fileId || !token || !userId || !(await verifyToken(token, projectId, userId))) {
    ws.close(4000, 'Unauthorized');
    return;
  }

  const file = await File.findOne({ fileId, projectId });
  if (!file) {
    ws.close(4004, 'File not found');
    return;
  }

  setupWSConnection(ws, req, { room: roomId });
});

// Existing editor routes (ensure compatibility with your current setup)
// Example: Get file content
app.get('/editor/:fileId/content', async (req, res) => {
  const { fileId } = req.params;
  const { userId, token } = req.query;
  const file = await File.findOne({ fileId });
  if (!file || !(await verifyToken(token, file.projectId, userId))) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  res.json({ success: true, content: file.content });
});

// Add to your existing auth route
app.post('/editor/auth', async (req, res) => {
  const { userId, projectId } = req.body;
  const project = await Project.findOne({ projectId });
  if (!project?.users.some(u => u.userId === userId && ['owner', 'collaborator'].includes(u.role))) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  const token = jwt.sign({ userId, projectId }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1h' });
  res.json({ success: true, token });
});

// Connect to MongoDB and start server
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Backend is running on port ${port}`);
  });
}).catch((err) => {
  console.error("Failed to connect to MongoDB:", err);
  process.exit(1);
});