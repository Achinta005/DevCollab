const express=require('express');
const User=require('../../models/User')

exports.delete_profile_pic=async (req, res) => {
  try {
    console.log('Delete profile pic route hit');
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    // Find user
    const user = await User.findOne({ username: username });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete from Cloudinary if exists
    if (user.profile && user.profile.cloudinaryPublicId) {
      try {
        await deleteFromCloudinary(user.profile.cloudinaryPublicId);
        console.log('Deleted from Cloudinary:', user.profile.cloudinaryPublicId);
      } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
        // Continue even if Cloudinary deletion fails
      }
    }

    // Initialize profile if it doesn't exist
    if (!user.profile) {
      user.profile = {};
    }

    // Update user in database
    user.profile.avatar = null;
    user.profile.cloudinaryPublicId = null;
    user.LastActive = new Date();
    await user.save();

    console.log('User avatar deleted from database');

    res.json({
      success: true,
      message: 'Profile picture deleted successfully',
      user: {
        id: user._id,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        profile: user.profile
      }
    });

  } catch (error) {
    console.error('Delete profile pic error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting profile picture'
    });
  }
}