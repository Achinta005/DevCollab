const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();
const port = process.env.PORT || 3001;

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

app.use((req, res, next) => {
  if (req.originalUrl === "/api/image/upload") {
    return next();
  }
  express.json({ limit: "10mb" })(req, res, next);
});

app.use((req, res, next) => {
  if (req.originalUrl === "/api/image/upload") {
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
app.use("/files", require("./routes/projectFiles")); // Ensure this points to projectfiles.js

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
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