const users = require("../constants/authorizedUsers");

const signIn = async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({
      code: 400,
      message: "Email and password are required",
    });
  }

  // Check against constants
  const user = users.find((u) => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({
      code: 401,
      message: "Invalid email or password",
    });
  }

  // Optionally generate a token
  res.status(200).json({
    code: 200,
    message: "Sign in successful",
    data: {
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
};

module.exports = { signIn };
