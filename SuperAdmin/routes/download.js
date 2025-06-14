// routes/fileRoutes.js
const express = require('express');
const router = express.Router();
const { downloadFile } = require('../controller/downloadController');

router.get('/download/:id', downloadFile);

module.exports = router;
