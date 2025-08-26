const express=require('express');
const User=require('../../models/User');

exports.get_profile_pic_url=async (req, res) => {
  try {
    console.log('Get profile pic route hit');
    const { username } = req.body;
    console.log('Requested username:', username);

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    // Find user and get profile picture
    const user = await User.findOne({ username: username })
      .select('username profile.avatar firstname lastname');
    
    console.log('Found user:', user ? user.username : 'null');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const avatarUrl = user.profile && user.profile.avatar ? user.profile.avatar : null;
    console.log('User avatar:', avatarUrl);

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