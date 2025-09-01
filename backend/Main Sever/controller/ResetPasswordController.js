const User = require('../models/User')
const OTP=require('../models/OTP');
const {generateOTP,sendOTPEmail}=require('../config/emailService')
const bcrypt = require('bcryptjs');

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
        console.log("\nEmail:",user.email,"Fetched successfully for",username,"\n")
    } catch (error) {
        console.error('Error retrieving user email:', error);
        res.status(500).json({ 
            error: "Internal server error",
            message: "Failed to retrieve user email"
        });
    }
};

exports.sendOTP= async (req, res) => {
    try {
        const { email, username } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        
        // Generate OTP
        const otp = generateOTP();
        
        // Save OTP to database
        const newOTP = new OTP({
            email: email,
            otp: otp
        });
        
        await newOTP.save();
        
        // Send OTP email
        const emailResult = await sendOTPEmail(email, otp, username);
        
        if (!emailResult.success) {
            return res.status(500).json({ 
                error: "Failed to send OTP email",
                message: emailResult.error
            });
        }
        
        res.status(200).json({
            success: true,
            message: "OTP sent successfully to your email"
        });
        console.log("\nOTP was Send successfully to",email,"For",username,"\n");
        
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to send OTP"
        });
    }
};

exports.verifyOTP= async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        if (!email || !otp) {
            return res.status(400).json({ error: "Email and OTP are required" });
        }
        
        // Find valid OTP
        const validOTP = await OTP.findOne({
            email: email,
            otp: otp,
            isUsed: false
        });
        
        if (!validOTP) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        }
        
        // Mark OTP as used
        validOTP.isUsed = true;
        await validOTP.save();
        
        res.status(200).json({
            success: true,
            message: "OTP verified successfully"
        });
        console.log("\nOTP(",otp,") Verified successfully\n")
        
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to verify OTP"
        });
    }
};

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