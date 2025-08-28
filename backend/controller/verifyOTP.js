const express = require("express");
const OTP=require('../models/OTP')


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