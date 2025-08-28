const exprress=require('express');
const User = require('../../models/User');

exports.update_user_profile_data=async (req, res) => {
  try {
    const { 
      username, 
      firstname, 
      lastname, 
      email, 
      bio, 
      skills, 
      experience, 
      github, 
      portfolio, 
      linkedin 
    } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    const user = await User.findOne({ username: username });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update basic fields
    if (firstname !== undefined) user.firstname = firstname;
    if (lastname !== undefined) user.lastname = lastname;
    if (email !== undefined) user.email = email;

    // Initialize profile if it doesn't exist
    if (!user.profile) {
      user.profile = {};
    }

    // Update profile fields
    if (bio !== undefined) user.profile.bio = bio;
    if (skills !== undefined) user.profile.skills = skills;
    if (experience !== undefined) user.profile.experience = experience;
    if (github !== undefined) user.profile.github = github;
    if (portfolio !== undefined) user.profile.portfolio = portfolio;
    if (linkedin !== undefined) user.profile.linkedin = linkedin;

    // Update last active
    user.LastActive = new Date();

    await user.save();

    console.log('\nUser profile updated Successfully... For ', username,"\n");

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        profile: user.profile,
        preferences: user.preferences,
        createdAt: user.createdAt,
        LastActive: user.LastActive
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
}