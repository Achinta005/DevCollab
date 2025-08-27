const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const mongoose = require("mongoose");
const bodyparser = require("body-parser");
require("dotenv").config();
const cors = require("cors");

// Import routes with error handling
let authRoutes, resetPassword, getProfilePicture, Profile_picture_modification;

try {
    console.log("Loading auth routes...");
    authRoutes = require('./routes/auth');
    console.log("Auth routes loaded successfully");
} catch (error) {
    console.error("Error loading auth routes:", error.message);
    process.exit(1);
}

try {
    console.log("Loading reset password routes...");
    resetPassword = require('./routes/ResetPassword');
    console.log("Reset password routes loaded successfully");
} catch (error) {
    console.error("Error loading reset password routes:", error.message);
    process.exit(1);
}

try {
    console.log("Loading profile picture routes...");
    getProfilePicture = require("./routes/getProfilePic");
    console.log("Profile picture routes loaded successfully");
} catch (error) {
    console.error("Error loading profile picture routes:", error.message);
    process.exit(1);
}

try {
    console.log("Loading profile picture modification routes...");
    Profile_picture_modification = require('./routes/Profile-pic');
    console.log("Profile picture modification routes loaded successfully");
} catch (error) {
    console.error("Error loading profile picture modification routes:", error.message);
    process.exit(1);
}

try {
    console.log("Loading project routes...");
    const projectRoutes = require('./routes/projectRoutes');
    console.log("Project routes loaded successfully");
} catch (error) {
    console.error("Error loading project routes:", error.message);
    process.exit(1);
}

const connectDB = require('./config/db');

// CORS configuration
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

app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Apply routes with error handling
try {
    console.log("Applying auth routes...");
    app.use('/api/auth', authRoutes);
    console.log("Auth routes applied successfully");
} catch (error) {
    console.error("Error applying auth routes:", error.message);
    process.exit(1);
}

try {
    console.log("Applying reset password routes...");
    app.use('/api/reset', resetPassword);
    console.log("Reset password routes applied successfully");
} catch (error) {
    console.error("Error applying reset password routes:", error.message);
    process.exit(1);
}

try {
    console.log("Applying profile picture routes...");
    app.use('/api/get', getProfilePicture);
    console.log("Profile picture routes applied successfully");
} catch (error) {
    console.error("Error applying profile picture routes:", error.message);
    process.exit(1);
}

try {
    console.log("Applying profile picture modification routes...");
    app.use('/api/image', Profile_picture_modification);
    console.log("Profile picture modification routes applied successfully");
} catch (error) {
    console.error("Error applying profile picture modification routes:", error.message);
    process.exit(1);
}

try {
    console.log("Applying project routes...");
    app.use('/api/projects', require('./routes/projectRoutes'));
    console.log("Project routes applied successfully");
} catch (error) {
    console.error("Error applying project routes:", error.message);
    process.exit(1);
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// Connect to database
connectDB();

app.listen(port, () => {
    console.log(`Backend is running on port ${port}`);
});
