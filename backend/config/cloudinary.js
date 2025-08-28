const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Test Cloudinary connection
const testCloudinaryConnection = async () => {
  try {
    const result = await cloudinary.api.ping();
    return true;
  } catch (error) {
    console.error('❌ Cloudinary connection failed:', error.message);
    return false;
  }
};

// Configure Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Get username from request body, with fallback
    const username = req.body?.username || 'anonymous';
    const timestamp = Date.now();
    const publicId = `${username}_${timestamp}`;
    
    console.log('Cloudinary params - Username:', username);
    console.log('Cloudinary params - Generated public_id:', publicId);
    
    return {
      folder: 'devcollab/profile_pictures',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      public_id: publicId,
      transformation: [
        {
          width: 400,
          height: 400,
          crop: 'fill',
          gravity: 'face',
          quality: 'auto:good',
          fetch_format: 'auto'
        }
      ]
    };
  }
});

// Configure multer with Cloudinary storage
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    console.log('File filter - received file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      username: req.body?.username
    });

    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Helper function to delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    console.log('Attempting to delete from Cloudinary:', publicId);
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image'
    });
    console.log('Cloudinary deletion result:', result);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

// Helper function to upload buffer directly to Cloudinary
const uploadBufferToCloudinary = async (buffer, username) => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const publicId = `${username}_${timestamp}`;
    
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        public_id: publicId,
        folder: 'devcollab/profile_pictures',
        transformation: [
          {
            width: 400,
            height: 400,
            crop: 'fill',
            gravity: 'face',
            quality: 'auto:good'
          }
        ]
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          console.log('Cloudinary upload success:', result.secure_url);
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

// Helper function to get optimized image URL
const getOptimizedImageUrl = (publicId, options = {}) => {
  const defaultOptions = {
    width: 400,
    height: 400,
    crop: 'fill',
    gravity: 'face',
    quality: 'auto:good',
    fetch_format: 'auto'
  };

  const finalOptions = { ...defaultOptions, ...options };
  
  return cloudinary.url(publicId, finalOptions);
};

// Helper function to get image info
const getImageInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return {
      public_id: result.public_id,
      version: result.version,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      created_at: result.created_at,
      secure_url: result.secure_url
    };
  } catch (error) {
    console.error('Error getting image info from Cloudinary:', error);
    return null;
  }
};

// Test connection on module load
if (process.env.NODE_ENV !== 'test') {
  testCloudinaryConnection();
}

module.exports = {
  cloudinary,
  upload,
  deleteFromCloudinary,
  uploadBufferToCloudinary,
  getOptimizedImageUrl,
  getImageInfo,
  testCloudinaryConnection
};