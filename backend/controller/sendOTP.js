const express = require("express");
const OTP=require('../models/OTP');
const {generateOTP,sendOTPEmail}=require('../config/emailService')

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
        
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to send OTP"
        });
    }
};
