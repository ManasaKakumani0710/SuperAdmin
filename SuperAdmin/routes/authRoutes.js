const express = require('express');
const router = express.Router();
const { signIn } = require('../controller/authController');

router.post('/auth/signin', signIn);

module.exports = router;