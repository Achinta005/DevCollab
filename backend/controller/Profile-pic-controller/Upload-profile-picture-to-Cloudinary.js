const express=require('express');
const { upload, deleteFromCloudinary } = require('../../config/cloudinary');
const User=require('../../models/User');

exports.upload_profile_picture_to_cloudinary=(req, res, next) => {
  console.log('Upload route hit');
  
  // Use multer middleware
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
      console.log('File after multer:', req.file);
      console.log('Body after multer:', req.body);

      // Check if file was uploaded
      if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Get username from request body
      const { username } = req.body;
      console.log('Username from body:', username);
      
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
      console.log('Looking for user:', username);
      const user = await User.findOne({ username: username });
      
      if (!user) {
        console.log('User not found:', username);
        // If user not found, delete the uploaded image from Cloudinary
        if (req.file.public_id) {
          await deleteFromCloudinary(req.file.public_id);
        }
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      console.log('User found:', user.username);

      // Delete old profile picture if it exists
      if (user.profile && user.profile.cloudinaryPublicId) {
        console.log('Deleting old image:', user.profile.cloudinaryPublicId);
        try {
          await deleteFromCloudinary(user.profile.cloudinaryPublicId);
          console.log('Old image deleted successfully');
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

      console.log('User updated with new avatar:', user.profile.avatar);
      console.log('Cloudinary public_id:', user.profile.cloudinaryPublicId);

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
          console.log('Cleanup: deleted uploaded file from cloudinary');
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