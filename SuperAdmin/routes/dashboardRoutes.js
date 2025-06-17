
const express = require('express');
const router = express.Router();

const {
  getSalesGraph,
  getDashboardSummary
} = require('../controller/dashboardController');

router.get('/dashboard/summary', getDashboardSummary);

router.get('/dashboard/graph', getSalesGraph);

module.exports = router;
