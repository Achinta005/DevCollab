const express = require('express');
const {upload_profile_picture_to_cloudinary,get_profile_pic_url,get_user_profile_data,update_user_profile_data,multer_error_handeller} = require('../controller/ProfilePictureController')


const router = express.Router();

router.post('/upload', upload_profile_picture_to_cloudinary);
router.post('/get/profile-pic',get_profile_pic_url );
router.get('/user/profile/:username',get_user_profile_data);
router.put('/user/profile', update_user_profile_data);
router.use(multer_error_handeller);


module.exports = router;