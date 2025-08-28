const express = require('express');
const {upload_profile_picture_to_cloudinary} = require('../controller/Profile-pic-controller/Upload-profile-picture-to-Cloudinary')
const{get_profile_pic_url}=require('../controller/Profile-pic-controller/get-profile-pic-url')
const {get_user_profile_data}=require('../controller/get-user-profile-data')
const {update_user_profile_data}=require('../controller/Profile-pic-controller/update-user-profile-data');
const {multer_error_handeller}=require('../controller/Profile-pic-controller/multer-error-handeller')


const router = express.Router();

router.post('/upload', upload_profile_picture_to_cloudinary);
router.post('/get/profile-pic',get_profile_pic_url );
router.get('/user/profile/:username',get_user_profile_data);
router.put('/user/profile', update_user_profile_data);
router.use(multer_error_handeller);


module.exports = router;