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

    // Use updateOne instead of save() to avoid validation issues
    const result = await Project.updateOne(
      { _id: project._id },
      {
        $push: {
          collaborators: {
            user: userId,
            role: "editor",
            permissions: ["read", "write"],
            joinedAt: new Date(),
          },
        },
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error("Failed to add collaborator");
    }

    // Get the updated project with populated collaborators
    const updatedProject = await Project.findById(project._id)
      .populate(
        "collaborators.user",
        "username firstname lastname profile.avatar"
      )
      .populate("owner", "username firstname lastname profile.avatar");

    res.json({
      success: true,
      data: updatedProject,
      message: "Successfully joined project",
    });
  } catch (error) {
    console.error("Error joining project:", error); // This will show the actual error
    res.status(500).json({
      success: false,
      message: "Error joining project",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
    console.error(error);
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
    return res
      .status(400)
      .json({ success: false, message: "ProjectId is required" });
  }
  try {
    const project = await Project.findById(projectID)
      .populate("owner", "username firstname lastname profile.avatar") // Add this line
      .populate(
        "collaborators.user",
        "username firstname lastname profile.avatar"
      )
      .sort({ updatedAt: -1 });
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }
    return res.json({ success: true, data: project });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateCollaboratorRole = async (req, res) => {
  try {
    const { projectId, collaboratorId, newRole } = req.body;

    if (!projectId || !collaboratorId || !newRole) {
      return res.status(400).json({
        success: false,
        message: "Project ID, collaborator ID, and new role are required",
      });
    }

    const permissions = getPermissionsForRole(newRole);

    // Update only the specific collaborator using MongoDB's positional operator
    const result = await Project.updateOne(
      {
        _id: projectId,
        "collaborators._id": collaboratorId,
      },
      {
        $set: {
          "collaborators.$.role": newRole,
          "collaborators.$.permissions": permissions,
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Project or collaborator not found",
      });
    }

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "No changes made",
      });
    }

    return res.json({
      success: true,
      message: "Role updated successfully",
      data: { permissions, role: newRole },
    });
  } catch (error) {
    console.error("Error updating collaborator role:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Helper function to get permissions based on role
function getPermissionsForRole(role) {
  switch (role) {
    case "viewer":
      return ["read"];
    case "commenter":
      return ["read", "comment"];
    case "editor":
      return ["read", "write"];
    case "owner":
      return [
        "read",
        "write",
        "delete",
        "manage_collaborators",
        "manage_settings",
      ];
    default:
      return ["read"];
  }
}

exports.removeCollaborator = async (req, res) => {
  try {
    const { projectId, collaboratorId } = req.body;

    console.log("Remove collaborator request:", { projectId, collaboratorId });

    // Validation
    if (!projectId || !collaboratorId) {
      return res.status(400).json({
        success: false,
        message: "Project ID and collaborator ID are required",
      });
    }

    // Method 1: Using updateOne with $pull (Recommended)
    const result = await Project.updateOne(
      { _id: projectId },
      {
        $pull: {
          collaborators: { _id: collaboratorId },
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Collaborator not found or already removed",
      });
    }

    return res.json({
      success: true,
      message: "Collaborator removed successfully",
    });
  } catch (error) {
    console.error("Error removing collaborator:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.addCollaborator = async (req, res) => {
  try {
    const { projectId, email, role = "editor" } = req.body;
    const requesterId = req.user.id;

    console.log("Add collaborator request:", { projectId, email, role });

    // Validation
    if (!projectId || !email) {
      return res.status(400).json({
        success: false,
        message: "Project ID and email are required",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Check if requester has permission to add collaborators
    const requesterCollab = project.collaborators.find(
      (collab) => collab.user.toString() === requesterId.toString()
    );

    if (
      !requesterCollab ||
      !requesterCollab.permissions.includes("manage_collaborators")
    ) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to add collaborators",
      });
    }

    // Check collaborator limit
    if (project.collaborators.length >= project.settings.maxCollaborators) {
      return res.status(400).json({
        success: false,
        message: "Project has reached maximum collaborators limit",
      });
    }

    // Find user by email
    const userToAdd = await User.findOne({ email });

    if (!userToAdd) {
      // User doesn't exist - send invitation email
      // This is where you'd implement email invitation logic
      // For now, we'll return a message
      return res.status(404).json({
        success: false,
        message:
          "User with this email not found. Email invitations not implemented yet.",
      });
    }

    // Check if user is already a collaborator
    const existingCollab = project.collaborators.find(
      (collab) => collab.user.toString() === userToAdd._id.toString()
    );

    if (existingCollab) {
      return res.status(400).json({
        success: false,
        message: "User is already a collaborator on this project",
      });
    }

    // Add user as collaborator using updateOne
    const result = await Project.updateOne(
      { _id: projectId },
      {
        $push: {
          collaborators: {
            user: userToAdd._id,
            role: role,
            permissions: getPermissionsForRole(role),
            joinedAt: new Date(),
          },
        },
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error("Failed to add collaborator");
    }

    // Get the newly added collaborator data
    const updatedProject = await Project.findById(projectId).populate(
      "collaborators.user",
      "username firstname lastname fullName profile"
    );

    const newCollaborator = updatedProject.collaborators.find(
      (collab) => collab.user._id.toString() === userToAdd._id.toString()
    );

    return res.json({
      success: true,
      message: `${userToAdd.username} has been added to the project`,
      data: {
        collaborator: newCollaborator,
      },
    });
  } catch (error) {
    console.error("Error adding collaborator:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
