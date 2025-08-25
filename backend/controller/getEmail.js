const express = require("express");
const router = express.Router();
const User = require('../models/User')

exports.getEmail= async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ error: "Username is required" });
        }
        let user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.status(200).json({ 
            success: true,
            email: user.email,
            message: "User email retrieved successfully"
        });
    } catch (error) {
        console.error('Error retrieving user email:', error);
        res.status(500).json({ 
            error: "Internal server error",
            message: "Failed to retrieve user email"
        });
    }
};
