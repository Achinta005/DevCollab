// Fixed FileController.js (Backend)
const Project = require("../models/Project");
const ProjectFile = require("../models/Projectfiles");
const s3Service = require("../services/s3Service");
const { formatFileSize } = require("../utils/format");
const ProjectFolder = require("../models/ProjectFolder");
const path = require("path");
const mongoose = require("mongoose"); // Added missing import

exports.FileUpload = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { description, tags, folder } = req.body; // Changed from folderPath
    const userId = req.user?.id || req.user?._id;

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });

    // Find project
    const project = await Project.findById(projectId);
    if (!project)
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });

    // Permission & quota checks
    if (!project.canUserUploadFiles(userId))
      return res.status(403).json({ success: false, message: "No permission" });

    if (!project.hasStorageSpace(req.file.size))
      return res
        .status(400)
        .json({ success: false, message: "Storage quota exceeded" });

    // Validate folder if provided
    let folderId = null;
    if (folder && folder !== "root") {
      const folderDoc = await ProjectFolder.findOne({
        _id: folder,
        project: projectId,
      });
      if (!folderDoc) {
        return res.status(404).json({ success: false, message: "Folder not found" });
      }
      folderId = folderDoc._id;
    }

    // Upload file to S3
    const s3Key = s3Service.generateS3Key(
      userId,
      projectId,
      req.file.originalname
    );
    const uploadResult = await s3Service.uploadFile(
      req.file.buffer,
      s3Key,
      req.file.mimetype,
      {
        originalName: req.file.originalname,
        uploadedBy: userId.toString(),
        projectId: projectId,
      }
    );

    // Create file record in DB
    const fileRecord = new ProjectFile({
      originalName: req.file.originalname,
      storedName: path.basename(s3Key),
      fileType: path.extname(req.file.originalname), // just store extension
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      s3Key,
      s3Bucket: process.env.S3_BUCKET_NAME,
      project: projectId,
      uploadedBy: userId,
      description: description || "",
      tags: tags
        ? tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag)
        : [],
      folder: folderId, // Now sets correct folder ID (null for root)
    });

    await fileRecord.save();

    // Update project info
    project.uploadedFiles.push(fileRecord._id);
    await project.updateStorageSize();

    // Return response
    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      file: fileRecord.getPublicData(),
    });
  } catch (error) {
    console.error("File upload error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "File upload failed",
        error: error.message,
      });
  }
};

// Get files for a project
exports.GetFiles_for_Project = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 20, category, folderId } = req.query;
    const userId = req.user?.id || req.user?._id; // Fixed: Added optional chaining

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Validate project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    // Check user permissions
    const canRead =
      project.owner.toString() === userId.toString() ||
      project.collaborators.some(
        (collab) =>
          collab.user.toString() === userId.toString() &&
          collab.permissions.includes("read")
      );
    if (!canRead) {
      return res.status(403).json({ success: false, message: "Permission denied" });
    }

    // Build query
    const query = {
      project: projectId,
      isActive: true,
    };
    if (category && category !== "all") {
      query.fileType = category;
    }
    if (folderId) {
      query.folder = folderId === "root" ? null : folderId;
    }

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch files
    const files = await ProjectFile.find(query)
      .select("originalName fileType mimeType fileSize folder uploadedBy uploadedAt description tags")
      .populate("uploadedBy", "username")
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const totalFiles = await ProjectFile.countDocuments(query);

    // Map files to public data
    const formattedFiles = files.map((file) => ({
      id: file._id,
      originalName: file.originalName,
      fileType: file.fileType,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      category: file.fileType, // Map fileType to category for frontend
      folder: file.folder,
      uploadedBy: file.uploadedBy?.username || "Unknown",
      uploadedAt: file.uploadedAt,
      description: file.description || "",
      tags: file.tags || [],
    }));

    // Pagination metadata
    const pagination = {
      totalFiles,
      totalPages: Math.ceil(totalFiles / limitNum),
      currentPage: pageNum,
      hasNext: pageNum < Math.ceil(totalFiles / limitNum),
      hasPrev: pageNum > 1,
    };

    res.status(200).json({
      success: true,
      files: formattedFiles,
      pagination,
    });
  } catch (error) {
    console.error("Error in GetFiles_for_Project:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get categories
exports.GetCategories = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || req.user?._id; // Fixed: Added optional chaining

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const canRead =
      project.owner.toString() === userId.toString() ||
      project.collaborators.some(
        (collab) =>
          collab.user.toString() === userId.toString() &&
          collab.permissions.includes("read")
      );
    if (!canRead) {
      return res.status(403).json({ success: false, message: "Permission denied" });
    }

    const categories = await ProjectFile.aggregate([
      { $match: { project: new mongoose.Types.ObjectId(projectId), isActive: true } },
      {
        $group: {
          _id: "$fileType",
          count: { $sum: 1 },
          totalSize: { $sum: "$fileSize" },
        },
      },
      {
        $project: {
          name: "$_id",
          count: 1,
          totalSize: 1,
          _id: 0,
        },
      },
    ]);

    res.status(200).json({ success: true, categories });
  } catch (error) {
    console.error("Error in GetCategories:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/folders/project/:projectId
exports.GetFoldersNew = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || req.user?._id; // Fixed: Added optional chaining

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Fetch all folders for the project
    const folders = await ProjectFolder.find({
      project: projectId,
      // createdBy: userId // Removed filter to make folders project-wide
    })
      .populate("parent", "name")
      .sort({ createdAt: 1 })
      .lean();

    // Build folder hierarchy
    const folderMap = {};
    const rootFolders = [];

    // First pass: create folder map
    folders.forEach((folder) => {
      folderMap[folder._id] = {
        ...folder,
        children: [],
      };
    });

    // Second pass: build hierarchy
    folders.forEach((folder) => {
      if (folder.parent) {
        // Add to parent's children
        if (folderMap[folder.parent._id]) {
          folderMap[folder.parent._id].children.push(folderMap[folder._id]);
        }
      } else {
        // Root level folder
        rootFolders.push(folderMap[folder._id]);
      }
    });

    // Create folder list for dropdown/selection (flattened structure)
    const flatFolders = [];

    const buildPath = (folder, path = "") => {
      const currentPath = path ? `${path}/${folder.name}` : folder.name;
      flatFolders.push({
        id: folder._id.toString(),
        name: folder.name,
        fullPath: currentPath,
        parent: folder.parent,
        level: path.split("/").length - 1 || 0,
      });

      folder.children.forEach((child) => {
        buildPath(child, currentPath);
      });
    };

    // Add root option
    flatFolders.push({
      id: "root",
      name: "Root",
      fullPath: "root",
      parent: null,
      level: 0,
    });

    rootFolders.forEach((folder) => {
      buildPath(folder);
    });

    res.json({
      success: true,
      folders: {
        hierarchy: rootFolders,
        flat: flatFolders.sort((a, b) => {
          if (a.id === "root") return -1;
          if (b.id === "root") return 1;
          return a.fullPath.localeCompare(b.fullPath);
        }),
      },
      count: folders.length,
    });
  } catch (error) {
    console.error("Error fetching project folders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch folders",
      error: error.message,
    });
  }
};

// GET /api/folders/:folderId/contents
exports.GetFolderContent = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { projectId } = req.query;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!projectId) {
      return res.status(400).json({ success: false, message: "Project ID required" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const canRead =
      project.owner.toString() === userId.toString() ||
      project.collaborators.some(
        (collab) =>
          collab.user.toString() === userId.toString() &&
          collab.permissions.includes("read")
      );
    if (!canRead) {
      return res.status(403).json({ success: false, message: "Permission denied" });
    }

    const query = folderId === "root"
      ? { parent: null, project: projectId }
      : { parent: folderId, project: projectId };

    const subfolders = await ProjectFolder.find(query)
      .select("name parent createdBy createdAt")
      .populate("createdBy", "username")
      .lean();

    console.log(`Fetched ${subfolders.length} subfolders for folderId: ${folderId}, projectId: ${projectId}`);

    res.status(200).json({
      success: true,
      subfolders,
    });
  } catch (error) {
    console.error("Get folder contents error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch folder contents", error: error.message });
  }
};

// POST /api/folders/create
exports.CreateFolderNew = async (req, res) => {
  try {
    const { name, parentId, projectId } = req.body;
    const userId = req.user?.id || req.user?._id; // Fixed: Added optional chaining

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Validate required fields
    if (!name || !projectId) {
      return res.status(400).json({
        success: false,
        message: "Name and project ID are required",
      });
    }

    // Check if folder with same name exists in the same parent
    const existingFolder = await ProjectFolder.findOne({
      name,
      parent: parentId === "root" ? null : parentId,
      project: projectId,
      // createdBy: userId // Removed filter
    });

    if (existingFolder) {
      return res.status(400).json({
        success: false,
        message: "A folder with this name already exists in this location",
      });
    }

    // Create new folder
    const newFolder = new ProjectFolder({
      name,
      parent: parentId === "root" ? null : parentId,
      project: projectId,
      createdBy: userId,
    });

    await newFolder.save();

    // Populate parent for response
    await newFolder.populate("parent", "name");

    res.status(201).json({
      success: true,
      folder: newFolder,
      message: "Folder created successfully",
    });
  } catch (error) {
    console.error("Error creating folder:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create folder",
      error: error.message,
    });
  }
};

exports.GetDownloadURL = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id || req.user?._id; // Fixed: Added optional chaining

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Find file with project info
    const file = await ProjectFile.findById(fileId).populate("project");

    if (!file || !file.isActive) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Check access permission
    const project = file.project;
    const hasAccess =
      project.owner.toString() === userId.toString() ||
      project.collaborators.some(
        (collab) => collab.user.toString() === userId.toString()
      );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Generate presigned URL for download
    const downloadUrl = await s3Service.generatePresignedUrl(
      file.s3Key,
      "getObject",
      3600, // 1 hour expiry
      {
        "Content-Disposition": `attachment; filename="${file.originalName}"`,
      }
    );

    // Update download count
    file.downloadCount = (file.downloadCount || 0) + 1;
    file.lastDownloadedAt = new Date();
    await file.save();

    res.json({
      success: true,
      downloadUrl,
      file: {
        id: file._id,
        originalName: file.originalName,
        fileSize: file.fileSize,
        readableSize: formatFileSize(file.fileSize),
      },
      expiresIn: "1 hour",
    });
  } catch (error) {
    console.error("Generate download URL error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate download URL",
    });
  }
};

exports.DeleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id || req.user?._id; // Fixed: Added optional chaining

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Find file with project info
    const file = await ProjectFile.findById(fileId).populate("project");

    if (!file || !file.isActive) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Check delete permission (owner or uploader can delete)
    const project = file.project;
    const canDelete =
      project.owner.toString() === userId.toString() ||
      file.uploadedBy.toString() === userId.toString() ||
      project.collaborators.some(
        (collab) =>
          collab.user.toString() === userId.toString() &&
          collab.permissions.includes("delete_files")
      );

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this file",
      });
    }

    // Delete from S3
    await s3Service.deleteFile(file.s3Key);

    // Soft delete from database
    file.isActive = false;
    file.deletedAt = new Date();
    file.deletedBy = userId;
    await file.save();

    // Remove from project's uploadedFiles array
    project.uploadedFiles = project.uploadedFiles.filter(
      (fileRef) => fileRef.toString() !== fileId
    );

    // Update project storage size
    await project.updateStorageSize();

    res.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete file error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete file",
    });
  }
};

exports.DeleteBulkFiles = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { fileIds } = req.body;
    const userId = req.user?.id || req.user?._id; // Fixed: Added optional chaining

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No file IDs provided" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    for (const fileId of fileIds) {
      const file = await ProjectFile.findById(fileId);

      if (!file || !file.isActive || file.project.toString() !== projectId) {
        continue; // Skip invalid files
      }

      const canDelete =
        project.owner.toString() === userId.toString() ||
        file.uploadedBy.toString() === userId.toString() ||
        project.collaborators.some(
          (collab) =>
            collab.user.toString() === userId.toString() &&
            collab.permissions.includes("delete_files")
        );

      if (!canDelete) {
        continue; // Skip if no permission
      }

      // Delete from S3
      await s3Service.deleteFile(file.s3Key);

      // Soft delete
      file.isActive = false;
      file.deletedAt = new Date();
      file.deletedBy = userId;
      await file.save();

      // Remove from project
      project.uploadedFiles = project.uploadedFiles.filter(
        (fileRef) => fileRef.toString() !== fileId
      );
    }

    await project.updateStorageSize();
    await project.save();

    res.json({
      success: true,
      message: "Bulk delete completed",
    });
  } catch (error) {
    console.error("Bulk delete files error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete files",
    });
  }
};

exports.DeleteFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user?.id || req.user?._id; // Fixed: Added optional chaining

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const folder = await ProjectFolder.findById(folderId).populate("project");
    if (!folder) {
      return res
        .status(404)
        .json({ success: false, message: "Folder not found" });
    }

    const project = folder.project;
    const hasAccess =
      project.owner.toString() === userId.toString() ||
      project.collaborators.some(
        (collab) => collab.user.toString() === userId.toString()
      );

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Check if folder has content (simple check, assume empty for now)
    const subfolders = await ProjectFolder.countDocuments({ parent: folderId });
    const files = await ProjectFile.countDocuments({ folderPath: folderId });

    if (subfolders > 0 || files > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Folder is not empty" });
    }

    // Delete folder
    await ProjectFolder.findByIdAndDelete(folderId);

    // Remove from project.folders
    project.folders = project.folders.filter((f) => f.toString() !== folderId);
    await project.save();

    res.json({ success: true, message: "Folder deleted successfully" });
  } catch (error) {
    console.error("Delete folder error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete folder" });
  }
};

exports.RenameFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { name } = req.body;
    const userId = req.user?.id || req.user?._id; // Fixed: Added optional chaining

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!name || name.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }

    const file = await ProjectFile.findById(fileId).populate("project");
    if (!file || !file.isActive) {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    const project = file.project;
    const canEdit =
      project.owner.toString() === userId.toString() ||
      file.uploadedBy.toString() === userId.toString() ||
      project.collaborators.some(
        (collab) =>
          collab.user.toString() === userId.toString() &&
          collab.permissions.includes("edit_files")
      );

    if (!canEdit) {
      return res
        .status(403)
        .json({ success: false, message: "No permission to rename" });
    }

    file.originalName = name.trim();
    file.updatedAt = new Date();
    file.lastModifiedBy = userId;
    await file.save();

    res.json({ success: true, message: "File renamed successfully" });
  } catch (error) {
    console.error("Rename file error:", error);
    res.status(500).json({ success: false, message: "Failed to rename file" });
  }
};

exports.RenameFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { name } = req.body;
    const userId = req.user?.id || req.user?._id; // Fixed: Added optional chaining

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!name || name.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }

    const folder = await ProjectFolder.findById(folderId).populate("project");
    if (!folder) {
      return res
        .status(404)
        .json({ success: false, message: "Folder not found" });
    }

    const project = folder.project;
    const hasAccess =
      project.owner.toString() === userId.toString() ||
      project.collaborators.some(
        (collab) => collab.user.toString() === userId.toString()
      );

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Check for duplicate name in parent
    const existing = await ProjectFolder.findOne({
      name: name.trim(),
      parent: folder.parent,
      _id: { $ne: folderId },
      project: project._id,
    });

    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Folder name already exists" });
    }

    folder.name = name.trim();
    await folder.save();

    res.json({ success: true, message: "Folder renamed successfully" });
  } catch (error) {
    console.error("Rename folder error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to rename folder" });
  }
};

exports.UpdateFiles = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { description, tags } = req.body;
    const userId = req.user?.id || req.user?._id; // Fixed: Added optional chaining

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Find file with project info
    const file = await ProjectFile.findById(fileId).populate("project");

    if (!file || !file.isActive) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Check edit permission
    const project = file.project;
    const canEdit =
      project.owner.toString() === userId.toString() ||
      file.uploadedBy.toString() === userId.toString() ||
      project.collaborators.some(
        (collab) =>
          collab.user.toString() === userId.toString() &&
          collab.permissions.includes("edit_files")
      );

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this file",
      });
    }

    // Update file metadata
    if (description !== undefined) {
      file.description = description;
    }

    if (tags !== undefined) {
      file.tags = Array.isArray(tags)
        ? tags
        : tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag);
    }

    file.updatedAt = new Date();
    file.lastModifiedBy = userId;
    await file.save();

    res.json({
      success: true,
      message: "File updated successfully",
      file: {
        ...file.getPublicData(),
        readableSize: formatFileSize(file.fileSize),
      },
    });
  } catch (error) {
    console.error("Update file error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update file",
    });
  }
};

exports.GetFiles = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id || req.user?._id; // Fixed: Added optional chaining

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Find file with populated data
    const file = await ProjectFile.findById(fileId)
      .populate("project", "name owner collaborators")
      .populate("uploadedBy", "username firstname lastname fullName")
      .populate("lastModifiedBy", "username firstname lastname fullName");

    if (!file || !file.isActive) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Check access permission
    const project = file.project;
    const hasAccess =
      project.owner.toString() === userId.toString() ||
      project.collaborators.some(
        (collab) => collab.user.toString() === userId.toString()
      );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Format response
    const fileData = {
      ...file.getPublicData(),
      readableSize: formatFileSize(file.fileSize),
      project: {
        id: project._id,
        name: project.name,
      },
      uploadedBy: file.uploadedBy
        ? {
            id: file.uploadedBy._id,
            username: file.uploadedBy.username,
            fullName:
              file.uploadedBy.fullName ||
              `${file.uploadedBy.firstname} ${
                file.uploadedBy.lastname || ""
              }`.trim(),
          }
        : null,
      lastModifiedBy: file.lastModifiedBy
        ? {
            id: file.lastModifiedBy._id,
            username: file.lastModifiedBy.username,
            fullName:
              file.lastModifiedBy.fullName ||
              `${file.lastModifiedBy.firstname} ${
                file.lastModifiedBy.lastname || ""
              }`.trim(),
          }
        : null,
      downloadCount: file.downloadCount || 0,
      lastDownloadedAt: file.lastDownloadedAt,
    };

    res.json({
      success: true,
      file: fileData,
    });
  } catch (error) {
    console.error("Get file details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch file details",
    });
  }
};