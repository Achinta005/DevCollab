const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const mongoose = require("mongoose");
require("dotenv").config();
const cors = require("cors");
const authRoutes = require("./routes/auth");
const resetPassword = require("./routes/ResetPassword");
const getProfilePicture = require("./routes/getProfilePic");
const Profile_picture_modification = require("./routes/Profile-pic");
const connectDB = require("./config/db");

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://dev-collab-git-main-achinta-hazras-projects.vercel.app",
      "https://dev-collab-ten.vercel.app",
    ],
    methods: ["GET", "POST", "OPTIONS", "PUT"],
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

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/reset", resetPassword);
app.use("/api/get", getProfilePicture);
app.use("/api/image", Profile_picture_modification);
app.use("/api/projects", require("./routes/projectRoutes"));

connectDB();

app.listen(port, () => {
  console.log(`Backend is running on port ${port}`);
});
