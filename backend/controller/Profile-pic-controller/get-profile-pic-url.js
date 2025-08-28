const express=require('express');
const User=require('../../models/User');

exports.get_profile_pic_url=async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    // Find user and get profile picture
    const user = await User.findOne({ username: username })
      .select('username profile.avatar firstname lastname');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const avatarUrl = user.profile && user.profile.avatar ? user.profile.avatar : null;
    console.log('\nUser avatar is :', avatarUrl,"For User",username,"\n");

    res.json({
      success: true,
      avatar: avatarUrl,
      username: user.username,
      firstname: user.firstname,
      lastname: user.lastname
    });

  } catch (error) {
    console.error('Get profile pic error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile picture'
    });
  }
}