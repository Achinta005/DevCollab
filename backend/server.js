const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const mongoose = require("mongoose");
const bodyparser = require("body-parser");
require("dotenv").config();
const cors = require("cors");
const authRoutes = require('./routes/auth');
const resetPassword = require('./routes/ResetPassword');
const getProfilePicture = require("./routes/getProfilePic");
const Profile_picture_modification = require('./routes/Profile-pic');
const connectDB = require('./config/db');

// CORS configuration - must be before routes
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://dev-collab-git-main-achinta-hazras-projects.vercel.app",
      "https://dev-collab-ten.vercel.app"
    ],
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    credentials: true,
  })
);

// Handle preflight requests explicitly
app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Remove duplicate bodyparser.json() as express.json() already handles this

// Test routes
app.get("/", (req, res) => {
    res.json({ message: "Welcome to DevCollab!" });
});

app.get("/connect", (req, res) => {
    console.log("Frontend Is Connected");
    res.json({ 
        message: "Backend connected successfully", 
        timestamp: new Date().toISOString(),
        status: "success"
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/reset', resetPassword);
app.use('/api/get', getProfilePicture);
app.use('/api/image', Profile_picture_modification);
app.use('/api/projects', require('./routes/projectRoutes'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl 
    });
});

// Connect to database
connectDB();

app.listen(port, () => {
    console.log(`Backend is running on port ${port}`);
});
