const express = require("express");
const router = express.Router();
const {getEmail,sendOTP,verifyOTP,resetPassword}=require('../controller/ResetPasswordController')

router.post('/Email',getEmail);
router.post('/send-otp',sendOTP);
router.post('/verify-otp',verifyOTP)
router.post('/reset-password',resetPassword)

module.exports = router;