const User = require("../models/users");
const Order = require("../models/Order");
const mongoose = require("mongoose");


const getSalesGraph = async (req, res) => {
  const { referenceDate } = req.query;
  const refDate = referenceDate ? new Date(referenceDate) : new Date();

  try {
    const [vendors, influencers, totalUsers, totalBrands] = await Promise.all([
      User.find({ userType: "vendor" }, "_id"),
      User.find({ userType: "influencer" }, "_id"),
      User.countDocuments(),
      User.countDocuments({ userType: "vendor" }), // Assuming vendors = brands
    ]);

    const vendorIds = vendors.map(u => u._id.toString());
    const influencerIds = influencers.map(u => u._id.toString());

    const timeBuckets = {
      Daily: generateTimeRanges(refDate, "hour", 4, 6),
      Weekly: generateTimeRanges(refDate, "day", 1, 7),
      Monthly: generateTimeRanges(refDate, "week", 7, 4),
      Yearly: generateTimeRanges(refDate, "month", 30, 12),
    };

    const weekdayMap = {
      1: "Mon",
      2: "Tue",
      3: "Wed",
      4: "Thu",
      5: "Fri",
      6: "Sat",
      7: "Sun"
    };

    const getGraphData = async (userIds, buckets, granularity) => {
      const match = {
        userId: { $in: userIds },
        createdAt: { $gte: buckets[0].start, $lte: buckets[buckets.length - 1].end },
      };

      const format = {
        hour: { format: "%H:00", field: "$createdAt" },
        day: { format: "%u", field: "$createdAt" }, // MongoDB doesn't support %a
        week: { format: "Week of %b %d", field: "$createdAt" },
        month: { format: "%b", field: "$createdAt" },
      }[granularity];

      const data = await Order.aggregate([
        { $match: match },
        {
          $project: {
            value: "$total",
            fullDate: "$createdAt",
            label: { $dateToString: { format: format.format, date: format.field } }
          },
        },
        {
          $group: {
            _id: "$label",
            value: { $sum: "$value" },
            fullDate: { $first: "$fullDate" }
          }
        },
        { $sort: { fullDate: 1 } }
      ]);

      return data.map((d, i) => {
        let labelValue = d._id;
        if (granularity === "day") {
          labelValue = weekdayMap[parseInt(d._id)];
        }

        return {
          id: i + 1,
          [granularity]: labelValue,
          value: d.value,
          fullDate: d.fullDate
        };
      });
    };

    const assembleData = async (label, granularity) => {
      const buckets = timeBuckets[label];
      const [salesData, ambassadorData] = await Promise.all([
        getGraphData(vendorIds, buckets, granularity),
        getGraphData(influencerIds, buckets, granularity),
      ]);

      return {
        periodLabel: label,
        salesData,
        ambassadorData,
        summary: {
          totalUsers,
          totalBrands,
          totalAmbassadors: influencerIds.length,
          totalSales: salesData.reduce((acc, d) => acc + d.value, 0),
        }
      };
    };

    const [Daily, Weekly, Monthly, Yearly] = await Promise.all([
      assembleData("Daily", "hour"),
      assembleData("Weekly", "day"),
      assembleData("Monthly", "week"),
      assembleData("Yearly", "month"),
    ]);

    return res.status(200).json({
      code: 200,
      message: "Dashboard data fetched",
      data: { Daily, Weekly, Monthly, Yearly }
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({
      code: 500,
      message: "Error fetching dashboard data",
      error: err.message
    });
  }
};

// Helper to generate date ranges for time buckets
function generateTimeRanges(referenceDate, unit, stepSize, count) {
  const ranges = [];
  const ref = new Date(referenceDate);
  for (let i = 0; i < count; i++) {
    const start = new Date(ref);
    const end = new Date(ref);

    if (unit === "hour") {
      start.setHours(i * stepSize, 0, 0, 0);
      end.setHours((i + 1) * stepSize - 1, 59, 59, 999);
    } else if (unit === "day") {
      start.setDate(ref.getDate() - (count - i - 1));
      end.setDate(start.getDate());
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (unit === "week") {
      start.setDate(ref.getDate() - ((count - i - 1) * stepSize));
      end.setDate(start.getDate() + 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (unit === "month") {
      const month = ref.getMonth() - (count - i - 1);
      start.setMonth(month, 1);
      end.setMonth(month + 1, 0);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    ranges.push({ start, end });
  }
  return ranges;
}


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
        { $group: { _id: "$userType", count: { $sum: 1 } } },
      ]);

      const counts = { general: 0, influencer: 0, vendor: 0 };
      result.forEach((u) => (counts[u._id] = u.count));
      return counts;
    };

    const vendorInfluencerUsers = await User.find(
      { userType: { $in: ["vendor", "influencer"] } },
      "_id"
    );
    const userIds = vendorInfluencerUsers.map(
      (u) => new mongoose.Types.ObjectId(u._id)
    );

    const getSales = async (startDate) => {
      const result = await Order.aggregate([
        {
          $match: {
            userId: { $in: userIds },
            createdAt: { $gte: startDate },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
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
          yearly: yearlyUsers,
        },
        salesTotals: {
          daily: dailySales,
          weekly: weeklySales,
          monthly: monthlySales,
          yearly: yearlySales,
        },
      },
    });
  } catch (err) {
    console.error("Dashboard Summary Error:", err);
    res.status(500).json({
      code: 500,
      message: "Failed to get summary",
      error: err.message,
    });
  }
};

module.exports = { getSalesGraph, getDashboardSummary };
