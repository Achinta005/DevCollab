const Project = require("../models/Project");
const User = require("../models/User");

// Create new project
exports.createProject = async (req, res) => {
  try {
    const { name, description, settings } = req.body;
    const userId = req.user.id; // From auth middleware
    const project = new Project({
      name,
      description,
      owner: userId,
      collaborators: [
        {
          user: userId,
          role: "owner",
          permissions: [
            "read",
            "write",
            "delete",
            "manage_collaborators",
            "manage_settings",
          ],
        },
      ],
      settings: {
        visibility: settings?.visibility || "private",
        allowedLanguages: settings?.allowedLanguages || ["javascript"],
        maxCollaborators: settings?.maxCollaborators || 10,
      },
    });
    // Generate invite code if not private
    if (project.settings.visibility !== "private") {
      project.generateInviteCode();
    }
    await project.save();
    await project.populate(
      "owner",
      "username firstname lastname profile.avatar"
    );
    res.status(201).json({
      success: true,
      data: project,
      message: "Project created successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating project",
      error: error.message,
    });
  }
};

// Join project via invite code
exports.joinProject = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user.id;
    const project = await Project.findOne({ inviteCode });
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Invalid invite code",
      });
    }
    // Check if already a collaborator
    const isCollaborator = project.collaborators.some(
      (collab) => collab.user.toString() === userId.toString()
    );
    if (isCollaborator) {
      return res.status(400).json({
        success: false,
        message: "You are already a collaborator on this project",
      });
    }
    // Check max collaborators limit
    if (project.collaborators.length >= project.settings.maxCollaborators) {
      return res.status(400).json({
        success: false,
        message: "Project has reached maximum collaborators limit",
      });
    }
    // Add user as collaborator
    project.collaborators.push({
      user: userId,
      role: "editor",
      permissions: ["read", "write"],
    });
    await project.save();
    await project.populate(
      "collaborators.user",
      "username firstname lastname profile.avatar"
    );
    res.json({
      success: true,
      data: project,
      message: "Successfully joined project",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error joining project",
      error: error.message,
    });
  }
};

// Get user's projects
exports.getUserProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    const projects = await Project.find({
      $or: [
        { owner: userId }, // Projects owned by user
        { "collaborators.user": userId }, // Projects where user is collaborator
      ],
    })
      .populate("owner", "username firstname lastname profile.avatar")
      .populate(
        "collaborators.user",
        "username firstname lastname profile.avatar"
      )
      .sort({ updatedAt: -1 });
    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching projects",
      error: error.message,
    });
  }
};

exports.getUserLinkProjects = async (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({
        success: false,
        message: "Invite code is required",
      });
    }

    const project = await Project.findOne({ inviteCode })
      .select("name description owner")
      .populate("owner", "username profile.avatar");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found for this invite code",
      });
    }

    // Send response
    res.status(200).json({
      success: true,
      data: {
        name: project.name,
        description: project.description,
        owner: {
          username: project.owner.username,
          avatar: project.owner.profile?.avatar || null,
        },
        inviteCode: inviteCode,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching project",
      error: error.message,
    });
  }
};

exports.Update_Project = async (req, res) => {
  console.log("Project Update Req Hit");
  const { projectID, projectName, projectDesc, maxCollaborators, visibility } =
    req.body;

  if (!projectID) {
    return res.status(400).json({
      success: false,
      message: "ProjectId is required",
    });
  }
  try {
    const project = await Project.findById(projectID);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    project.name = projectName || project.name;
    project.description = projectDesc || project.description;
    project.settings.maxCollaborators =
      maxCollaborators || project.settings.maxCollaborators;
    project.settings.visibility = visibility || project.settings.visibility;

    await project.save();

    return res.json({
      success: true,
      message: "Project updated successfully",
      project,
    });
  } catch (error) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getProject = async (req, res) => {
  console.log("Sending Project Data...");
  const { projectID } = req.body;
  if (!projectID) {
    return res.status(400).json({ success: false, message: "ProjectId is required" });
  }
  try {
    const project = await Project.findById(projectID);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }
    return res.json({ success: true, data: project });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
