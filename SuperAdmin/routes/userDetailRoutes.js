const express = require('express');
const router = express.Router();

const { getBusinessUsers,getUserDetails ,
    updateVendorStatus,updateInfluencerBan} = require('../controller/userDetails');


router.get('/business/users', getBusinessUsers);
router.get('/user/details', getUserDetails);
router.post('/user/vendor/status', updateVendorStatus);
router.post('/user/influencer/ban', updateInfluencerBan);


module.exports = router;
