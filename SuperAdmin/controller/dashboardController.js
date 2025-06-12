const User = require('../models/users');
const Order = require('../models/Order');
const mongoose = require('mongoose');

const getSalesGraph = async (req, res) => {
  const { type = 'Monthly' } = req.query;

  if (!['Daily', 'Weekly', 'Monthly', 'Yearly'].includes(type)) {
    return res.status(400).json({ message: 'Invalid report type' });
  }

  let dateFormat;
  switch (type) {
    case 'Daily':
      dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
      break;
    case 'Weekly':
      dateFormat = { $dateToString: { format: "%G-W%V", date: "$createdAt" } };
      break;
    case 'Monthly':
      dateFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
      break;
    case 'Yearly':
      dateFormat = { $dateToString: { format: "%Y", date: "$createdAt" } };
      break;
  }

  try {
    const [vendors, influencers] = await Promise.all([
      User.find({ userType: 'vendor' }, '_id'),
      User.find({ userType: 'influencer' }, '_id')
    ]);
   const vendorIds = vendors.map(user => user._id.toString());
const influencerIds = influencers.map(user => user._id.toString());

    const getSales = async (userIds) => {
      return await Order.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: dateFormat, total: { $sum: "$total" } } },
        { $sort: { _id: 1 } }
      ]);
    };

    const [vendorSales, influencerSales] = await Promise.all([
      getSales(vendorIds),
      getSales(influencerIds)
    ]);

    const labelSet = new Set([
      ...vendorSales.map(d => d._id),
      ...influencerSales.map(d => d._id)
    ]);
    const labels = Array.from(labelSet).sort();

    const mapData = (data) => {
      const mapped = {};
      data.forEach(d => mapped[d._id] = d.total);
      return labels.map(label => mapped[label] || 0);
    };

    res.status(200).json({
      code: 200,
      message: "Sales graph data",
      data: {
        labels,
        vendor: mapData(vendorSales),
        influencer: mapData(influencerSales)
      }
    });

  } catch (err) {
    console.error("Sales Graph Error:", err);
    res.status(500).json({
      code: 500,
      message: "Failed to get sales graph",
      error: err.message
    });
  }
};

const getDashboardSummary = async (req, res) => {
  try {
    const userCounts = await User.aggregate([
      { $group: { _id: "$userType", count: { $sum: 1 } } }
    ]);

    const totalUsers = { general: 0, influencer: 0, vendor: 0 };
    userCounts.forEach(u => {
      totalUsers[u._id] = u.count;
    });

    const users = await User.find({ userType: { $in: ['vendor', 'influencer'] } }, '_id');
    console.log("usersPresent::",users) 
    const userIds = users.map(u => u._id.toString());
    console.log("userIds::",userIds);

    const matchedOrders = await Order.find({ userId: { $in: userIds } });
console.log("Matched Orders:", matchedOrders);
console.log("Matched Count:", matchedOrders.length);
    

    const totalSalesAgg = await Order.aggregate([
  { $match: { userId: { $in: userIds } } },
  { $group: { _id: null, total: { $sum: "$total" } } }
]);
    const totalSales = totalSalesAgg[0]?.total || 0;

    res.status(200).json({
      code: 200,
      message: "Dashboard summary data",
      data: {
        totalUsers,
        totalSales
      }
    });
  } catch (err) {
    console.error("Dashboard Summary Error:", err);
    res.status(500).json({
      code: 500,
      message: "Failed to get summary",
      error: err.message
    });
  }
};

module.exports = { getSalesGraph, getDashboardSummary };
