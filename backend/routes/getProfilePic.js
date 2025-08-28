const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.post("/profile-pic", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: "User doesn't exist" });
    }

    const avatar =
      user.profile?.avatar ||
      "https://res.cloudinary.com/dc1fkirb4/image/upload/v1756140468/cropped_circle_image_dhaq8x.png";

    console.log("\nProfile Picture(", user.profile?.avatar, ") Fetched successfully\n");
    return res.json({ avatar });
  } catch (error) {
    console.error("Error in Fetching User Avatar:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
