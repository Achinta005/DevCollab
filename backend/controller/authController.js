const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { error } = require("console");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  const { firstname, lastname, email, password } = req.body;
  let user = await User.findOne({ firstname });
  if (user) {
    return res.status(400).json({ error: "User with same Username Exist" });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username: firstname,
      firstname,
      lastname,
      email,
      password: hashedPassword,
    });
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(400).json({ error: "Error registering user" });
  }
};

exports.login = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    console.log(error);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(402).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        FirstName: user.firstname,
        LastName: user.lastname,
        Email: user.email,
        Profile: {
          avatar: user.profile.avatar,
          bio: user.profile.bio,
          skills: user.profile.skills,
          experience: user.profile.experience,
          github: user.profile.github,
          portfolio: user.profile.portfolio,
          linkedin: user.profile.linkedin,
        },
        Preferences: {
          theme: user.preferences.theme,
          notification: user.preferences.notification,
        },
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: "Login error" });
  }
};
