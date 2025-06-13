const User = require('../models/users');
const Order = require('../models/Order');
const mongoose = require('mongoose');

const getSalesGraph = async (req, res) => {
  const { type = 'Monthly', startDate, endDate } = req.body;

  if (!['Daily', 'Weekly', 'Monthly', 'Yearly'].includes(type)) {
    return res.status(400).json({ message: 'Invalid report type' });
  }

  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'startDate and endDate are required' });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999); // include full end date

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
        {
          $match: {
            userId: { $in: userIds },
            createdAt: { $gte: start, $lte: end }
          }
        },
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
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    
    const getUserCounts = async (startDate) => {
      const result = await User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: "$userType", count: { $sum: 1 } } }
      ]);

      const counts = { general: 0, influencer: 0, vendor: 0 };
      result.forEach(u => counts[u._id] = u.count);
      return counts;
    };

   
    const vendorInfluencerUsers = await User.find(
      { userType: { $in: ['vendor', 'influencer'] } },
      '_id'
    );
    const userIds = vendorInfluencerUsers.map(u => new mongoose.Types.ObjectId(u._id));

    const getSales = async (startDate) => {
      const result = await Order.aggregate([
        {
          $match: {
            userId: { $in: userIds },
            createdAt: { $gte: startDate }
          }
        },
        { $group: { _id: null, total: { $sum: "$total" } } }
      ]);
      return result[0]?.total || 0;
    };

    
    const totalUserCounts = await getUserCounts(new Date(0));

    // --- Time-based User Counts ---
    const dailyUsers = await getUserCounts(startOfDay);
    const weeklyUsers = await getUserCounts(startOfWeek);
    const monthlyUsers = await getUserCounts(startOfMonth);
    const yearlyUsers = await getUserCounts(startOfYear);

    // --- Time-based Sales Totals ---
    const totalSales = await getSales(new Date(0));
    const dailySales = await getSales(startOfDay);
    const weeklySales = await getSales(startOfWeek);
    const monthlySales = await getSales(startOfMonth);
    const yearlySales = await getSales(startOfYear);

    
    res.status(200).json({
      code: 200,
      message: "Dashboard summary data",
      data: {
        userCounts: {
          daily: dailyUsers,
          weekly: weeklyUsers,
          monthly: monthlyUsers,
          yearly: yearlyUsers
        },
        salesTotals: {
          
          daily: dailySales,
          weekly: weeklySales,
          monthly: monthlySales,
          yearly: yearlySales
        }
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
