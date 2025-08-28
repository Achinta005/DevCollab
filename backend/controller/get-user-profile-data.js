const express = require("express");
const User = require("../models/User");

exports.get_user_profile_data = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username: username }).select(
      "-password -__v"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        profile: user.profile || {},
        preferences: user.preferences || {},
        createdAt: user.createdAt,
        LastActive: user.LastActive,
      },
    });
    console.log(
      "\nFetched User Profile Data Successfully... For ",username,"\n"
    );
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user profile",
    });
  }
};
