const express=require('express');
const { upload, deleteFromCloudinary } = require('../config/cloudinary');
const User=require('../models/User');

exports.upload_profile_picture_to_cloudinary=(req, res, next) => {
  upload.single('profilePic')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      
      // Handle multer specific errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size is 5MB.'
        });
      }
      
      if (err.message === 'Only image files are allowed') {
        return res.status(400).json({
          success: false,
          message: 'Only image files are allowed'
        });
      }
      
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    }

    try {

      // Check if file was uploaded
      if (!req.file) {
        console.log('\nNo file in request\n');
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Get username from request body
      const { username } = req.body;
      
      if (!username) {
        // If username not in body, cleanup uploaded file
        if (req.file.public_id) {
          await deleteFromCloudinary(req.file.public_id);
        }
        return res.status(400).json({
          success: false,
          message: 'Username is required'
        });
      }

      // Find user in database
      console.log('\nLooking for user:', username,"\n");
      const user = await User.findOne({ username: username });
      
      if (!user) {
        console.log('\nUser not found:', username,"\n");
        // If user not found, delete the uploaded image from Cloudinary
        if (req.file.public_id) {
          await deleteFromCloudinary(req.file.public_id);
        }
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      console.log('\nUser found:', user.username,"\n");

      // Delete old profile picture if it exists
      if (user.profile && user.profile.cloudinaryPublicId) {
        console.log('\nDeleting old image:', user.profile.cloudinaryPublicId,"\n");
        try {
          await deleteFromCloudinary(user.profile.cloudinaryPublicId);
          console.log('\nOld image deleted successfully\n');
        } catch (error) {
          console.error('Error deleting old profile picture:', error);
          // Continue with upload even if deletion fails
        }
      }

      // Initialize profile object if it doesn't exist
      if (!user.profile) {
        user.profile = {};
      }

      // Update user with new profile picture
      user.profile.avatar = req.file.secure_url || req.file.path;
      user.profile.cloudinaryPublicId = req.file.public_id || req.file.filename;
      user.LastActive = new Date();
      
      await user.save();

      console.log('\nUser updated with new avatar:', user.profile.avatar,"\n");

      res.json({
        success: true,
        message: 'Profile picture uploaded successfully',
        imageUrl: req.file.secure_url,
        publicId: req.file.public_id,
        user: {
          id: user._id,
          username: user.username,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          profile: user.profile,
          createdAt: user.createdAt
        }
      });

    } catch (error) {
      console.error('Upload processing error:', error);

      // If there was an error and file was uploaded, clean up
      if (req.file && req.file.public_id) {
        try {
          await deleteFromCloudinary(req.file.public_id);
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded file:', cleanupError);
        }
      }

      // Handle specific errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map(e => e.message)
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during upload',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
}

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

exports.multer_error_handeller=(error, req, res, next) => {
  console.error('Router error:', error);
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Maximum size is 5MB.'
    });
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field'
    });
  }

  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Upload failed'
  });
}