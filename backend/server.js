const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const mongoose = require("mongoose");
const bodyparser = require("body-parser");
require("dotenv").config();
const cors = require("cors");

const authRoutes=require('./routes/auth');
const resetPassword=require('./routes/ResetPassword')
const getProfilePicture=require("./routes/getProfilePic")
const Profile_picture_modification=require('./routes/Profile-pic')
const connectDB=require('./config/db');

app.use(
  cors({
    origin: ["http://localhost:3000","https://dev-collab-git-main-achinta-hazras-projects.vercel.app","https://dev-collab-ten.vercel.app"],
    methods: ["GET", "POST", "OPTIONS","PUT"],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyparser.json());
app.use(express.json());


app.get("/",(req,res)=>{
    res.send("Welcome to DevCollab !");
});
app.get("/connect",(req,res)=>{
    console.log("Frontend Is Connected")
});


//Routes
app.use('/api/auth',authRoutes);
app.use('/api/reset',resetPassword)
app.use('/api/get',getProfilePicture)
app.use('/api/image',Profile_picture_modification)
app.use('/api/projects', require('./routes/projectRoutes'));

connectDB();

app.listen(port,()=>{
    console.log(`Backend is running on port ${port}`)
})