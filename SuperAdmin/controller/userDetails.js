const User = require("../models/users");
const vendorDocument = require("../models/vendorDocument");

const getBusinessUsers = async (req, res) => {
  // extract and parse page and limit from req.body
  let { page, limit, type } = req.body;

  page = parseInt(page) || 1;
  limit = parseInt(limit);
  if (!Number.isInteger(limit) || limit <= 0) {
    limit = 10; // default fallback
  }

  const skip = (page - 1) * limit;

  // Validate user type if provided
  const validTypes = ["vendor", "influencer"];
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({
      code: 400,
      message: "Invalid userType. Must be 'vendor' or 'influencer'.",
    });
  }

  try {
    // Build the query dynamically based on user type
    const query = type ? { userType: type } : { userType: { $in: validTypes } };

    // Fetch users
    const users = await User.find(query)
      .select("_id name userType profile status isBan brand followers profile")
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    // Format response
    const formatted = users.map((user) => ({
      id: user._id,
      name: user.userType === "vendor" ? user.profile?.businessName : user.name,
      location:
        user.userType === "vendor"
          ? `${user.profile?.businessAddress?.state || ""}, ${
              user.profile?.businessAddress?.country || ""
            }`
          : `${user.profile?.state || ""}, ${user.profile?.country || ""}`,
      category:
        user.userType === "vendor" ? user.profile?.categories : undefined,
      niche:
        user.userType === "influencer" ? user.profile?.niche || "" : undefined,
      status: user.userType === "vendor" ? user.status : undefined,
      isBan: user.userType === "influencer" ? user.isBan : undefined,
    }));

    // Return response
    res.status(200).json({
      code: 200,
      message: "Business users fetched",
      data: {
        total,
        page,
        limit,
        users: formatted,
      },
    });
  } catch (err) {
    res.status(500).json({
      code: 500,
      message: "Failed to fetch users",
      error: err.message,
    });
  }
};

const getUserDetails = async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({
      code: 400,
      message: "Missing userId in request",
    });
  }

  try {
    const user = await User.findById(userId).select(
      "-password -token -sessions -__v"
    );

    if (!user) {
      return res.status(404).json({
        code: 404,
        message: "User not found",
      });
    }

    const documents = await vendorDocument.find({ userId }).select("-__v");

    res.status(200).json({
      code: 200,
      message: "User details fetched successfully",
      data: {
        user,
        documents,
      },
    });
  } catch (err) {
    res.status(500).json({
      code: 500,
      message: "Failed to fetch user",
      error: err.message,
    });
  }
};

const updateVendorStatus = async (req, res) => {
  const { userId, status } = req.body;

  if (!userId || !status) {
    return res.status(400).json({
      code: 400,
      message: "userId and status are required",
    });
  }

  try {
    const user = await User.findOne({ _id: userId });

    if (!user) {
      return res.status(404).json({
        code: 404,
        message: "User not found",
      });
    }

    user.status = status;
    await user.save();

    res.status(200).json({
      code: 200,
      message: "User status updated successfully",
      data: {
        id: user._id,
        name: user.name,
        status: user.status,
      },
    });
  } catch (err) {
    res.status(500).json({
      code: 500,
      message: "Failed to update status",
      error: err.message,
    });
  }
};

const updateInfluencerBan = async (req, res) => {
  const { userId, isBan } = req.body;

  if (typeof userId === "undefined" || typeof isBan === "undefined") {
    return res.status(400).json({
      code: 400,
      message: "userId and isBan are required",
    });
  }

  try {
    const user = await User.findOne({ _id: userId, userType: "influencer" });

    if (!user) {
      return res.status(404).json({
        code: 404,
        message: "Influencer not found",
      });
    }

    user.isBan = isBan;
    await user.save();

    res.status(200).json({
      code: 200,
      message: "Influencer ban status updated successfully",
      data: {
        id: user._id,
        name: user.name,
        isBan: user.isBan,
      },
    });
  } catch (err) {
    res.status(500).json({
      code: 500,
      message: "Failed to update ban status",
      error: err.message,
    });
  }
};

module.exports = {
  getBusinessUsers,
  getUserDetails,
  updateVendorStatus,
  updateInfluencerBan,
};
