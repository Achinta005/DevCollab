const express = require("express");
const router = express.Router();
const {getEmail}=require('../controller/getEmail')
const {sendOTP}=require('../controller/sendOTP');
const {verifyOTP}=require("../controller/verifyOTP")
const {resetPassword}=require('../controller/resetPassword');

router.post('/Email',getEmail);
router.post('/send-otp',sendOTP);
router.post('/verify-otp',verifyOTP)
router.post('/reset-password',resetPassword)

module.exports = router;