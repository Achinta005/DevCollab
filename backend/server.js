const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const mongoose = require("mongoose");
const bodyparser = require("body-parser");
require("dotenv").config();
const cors = require("cors");

const authRoutes=require('./routes/auth');
const resetPassword=require('./routes/ResetPassword')
const connectDB=require('./config/db');

app.use(
  cors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  })
);

app.get("/",(req,res)=>{
    res.send("Welcome to DevCollab !");
});

app.use(bodyparser.json());
app.use(express.json());

//Routes
app.use('/api/auth',authRoutes);
app.use('/api/reset',resetPassword)

connectDB();

app.listen(port,()=>{
    console.log(`Backend is running on por ${port}`)
})