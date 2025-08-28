const express=require('express');
const User=require('../models/User');
const bcrypt = require('bcryptjs');

exports.resetPassword= async (req, res) => {
    try {
        const { username, newPassword } = req.body;
        
        if (!username || !newPassword) {
            return res.status(400).json({ error: "Username and new password are required" });
        }
        
        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        
        // Update user password
        user.password = hashedPassword;
        await user.save();
        
        res.status(200).json({
            success: true,
            message: "Password reset successfully"
        });
        console.log("\nPassword(",hashedPassword,") Updated successfully\n");
        
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to reset password"
        });
    }
};