const Project = require("../models/Project");
const ProjectFile = require("../models/Projectfiles");
const s3Service = require("../services/s3Service");
const { formatFileSize } = require("../utils/format");
const ProjectFolder = require("../models/ProjectFolder");
const path = require("path");
const mongoose = require("mongoose");
const AWS = require("aws-sdk");
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

exports.FileUpload = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Safe destructuring with defaults to handle undefined req.body
    const {
      description = "",
      tags = "",
      folder = "root",
      originalName = null,
    } = req.body || {};

    const userId = req.user?.id || req.user?._id;

    console.log("FileUpload Debug Info:", {
      projectId,
      hasReqBody: !!req.body,
      reqBodyKeys: req.body ? Object.keys(req.body) : "undefined",
      reqBody: req.body,
      hasFile: !!req.file,
      fileInfo: req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
          }
        : "no file",
      contentType: req.get("Content-Type"),
      method: req.method,
    });

    if (!userId) {
      console.error("Authentication required: No user ID found");
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      console.error("Invalid projectId:", projectId);
      return res
        .status(400)
        .json({ success: false, message: "Invalid project ID" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      console.error("Project not found for ID:", projectId);
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    if (!project.canUserUploadFiles(userId)) {
      console.error("Permission denied for user:", userId);
      return res
        .status(403)
        .json({ success: false, message: "No permission to upload files" });
    }

    let folderId = null;
    if (folder && folder !== "root") {
      if (!mongoose.Types.ObjectId.isValid(folder)) {
        console.error("Invalid folder ID:", folder);
        return res
          .status(400)
          .json({ success: false, message: "Invalid folder ID" });
      }
      const folderDoc = await ProjectFolder.findOne({
        _id: folder,
        project: projectId,
      });
      if (!folderDoc) {
        console.error("Folder not found:", folder);
        return res
          .status(404)
          .json({ success: false, message: "Folder not found" });
      }
      folderId = folderDoc._id;
    }

    // Handle case where no file is provided (empty file creation)
    if (!req.file) {
      console.log("No file provided, checking for originalName in body");

      if (!originalName) {
        console.error("No file provided and no originalName in body");
        return res.status(400).json({
          success: false,
          message: "Either file upload or originalName is required",
          debug: {
            hasReqBody: !!req.body,
            reqBody: req.body,
          },
        });
      }

      // Create empty file
      const fileType = path.extname(originalName).toLowerCase();
      const mimeType =
        {
          ".js": "text/javascript",
          ".txt": "text/plain",
          ".json": "application/json",
          ".html": "text/html",
          ".css": "text/css",
          ".py": "application/x-python-code",
        }[fileType] || "text/plain";

      const s3Key = s3Service.generateS3Key(userId, projectId, originalName);
      console.log("Creating empty file with S3 key:", s3Key);

      try {
        await s3Service.uploadFile(Buffer.from(""), s3Key, mimeType, {
          originalName,
          uploadedBy: userId.toString(),
          projectId,
        });
      } catch (s3Error) {
        console.error("S3 upload failed for empty file:", s3Error);
        return res.status(500).json({
          success: false,
          message: "Failed to upload to S3",
          error: s3Error.message,
        });
      }

      const fileRecord = new ProjectFile({
        originalName,
        storedName: path.basename(s3Key),
        fileType,
        mimeType,
        fileSize: 0,
        s3Key,
        s3Bucket: process.env.S3_BUCKET_NAME,
        project: projectId,
        uploadedBy: userId,
        lastModifiedBy: userId,
        description: description || "",
        tags: tags
          ? tags
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag)
          : [],
        folder: folderId,
      });

      await fileRecord.save();
      console.log("Empty file record saved:", fileRecord._id);

      project.uploadedFiles.push(fileRecord._id);
      await project.updateStorageSize();
      await project.save();

      return res.status(201).json({
        success: true,
        message: "Empty file created successfully",
        file: fileRecord.getPublicData(),
      });
    }

    // Handle regular file upload
    if (!project.hasStorageSpace(req.file.size)) {
      console.error("Storage quota exceeded for project:", projectId);
      return res
        .status(400)
        .json({ success: false, message: "Storage quota exceeded" });
    }

    try {
      s3Service.validateFile(req.file);
    } catch (error) {
      console.error("File validation failed:", error.message);
      return res.status(400).json({ success: false, message: error.message });
    }

    // Use originalName from body if file.originalname is generic (like "blob")
    const actualFileName =
      req.file.originalname === "blob" && originalName
        ? originalName
        : req.file.originalname;
    const fileExtension = path.extname(actualFileName);

    console.log("File naming debug:", {
      fileOriginalname: req.file.originalname,
      bodyOriginalName: originalName,
      actualFileName,
      fileExtension,
    });

    const s3Key = s3Service.generateS3Key(userId, projectId, actualFileName);
    console.log("Uploading regular file to S3:", {
      s3Key,
      mimeType: req.file.mimetype,
      size: req.file.size,
      actualFileName,
    });

    const uploadResult = await s3Service.uploadFile(
      req.file.buffer,
      s3Key,
      req.file.mimetype,
      {
        originalName: actualFileName,
        uploadedBy: userId.toString(),
        projectId,
      }
    );

    const fileRecord = new ProjectFile({
      originalName: actualFileName,
      storedName: path.basename(s3Key),
      fileType: fileExtension,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      s3Key,
      s3Bucket: process.env.S3_BUCKET_NAME,
      project: projectId,
      uploadedBy: userId,
      lastModifiedBy: userId,
      description: description || "",
      tags: tags
        ? tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag)
        : [],
      folder: folderId,
    });

    await fileRecord.save();
    console.log("File record saved:", fileRecord._id);

    project.uploadedFiles.push(fileRecord._id);
    await project.updateStorageSize();
    await project.save();

    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      file: fileRecord.getPublicData(),
    });
  } catch (error) {
    console.error("FileUpload error:", {
      projectId: req.params.projectId,
      error: error.message,
      stack: error.stack,
      hasReqBody: !!req.body,
      reqBody: req.body,
      hasFile: !!req.file,
    });
    res.status(500).json({
      success: false,
      message: "File upload failed",
      error: error.message,
    });
  }
};

// Alternative: Create a separate endpoint for file creation
exports.CreateFile = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { originalName, folder, content = "", description, tags } = req.body;
    const userId = req.user?.id || req.user?._id;

    console.log("CreateFile called with:", {
      projectId,
      originalName,
      folder,
      hasContent: content.length > 0,
    });

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid project ID" });
    }

    if (!originalName) {
      return res
        .status(400)
        .json({ success: false, message: "File name is required" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    if (!project.canUserUploadFiles(userId)) {
      return res
        .status(403)
        .json({ success: false, message: "No permission to create files" });
    }

    let folderId = null;
    if (folder && folder !== "root") {
      if (!mongoose.Types.ObjectId.isValid(folder)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid folder ID" });
      }
      const folderDoc = await ProjectFolder.findOne({
        _id: folder,
        project: projectId,
      });
      if (!folderDoc) {
        return res
          .status(404)
          .json({ success: false, message: "Folder not found" });
      }
      folderId = folderDoc._id;
    }

    // Check for duplicate file names
    const existingFile = await ProjectFile.findOne({
      originalName,
      project: projectId,
      folder: folderId,
    });

    if (existingFile) {
      return res.status(409).json({
        success: false,
        message: `File "${originalName}" already exists in this location`,
      });
    }

    const fileType = path.extname(originalName).toLowerCase();
    const mimeType =
      {
        ".js": "text/javascript",
        ".txt": "text/plain",
        ".json": "application/json",
        ".html": "text/html",
        ".css": "text/css",
        ".py": "application/x-python-code",
      }[fileType] || "text/plain";

    const fileContent = Buffer.from(content, "utf8");
    const fileSize = fileContent.length;

    if (!project.hasStorageSpace(fileSize)) {
      return res
        .status(400)
        .json({ success: false, message: "Storage quota exceeded" });
    }

    const s3Key = s3Service.generateS3Key(userId, projectId, originalName);

    try {
      await s3Service.uploadFile(fileContent, s3Key, mimeType, {
        originalName,
        uploadedBy: userId.toString(),
        projectId,
      });
    } catch (s3Error) {
      console.error("S3 upload failed:", s3Error);
      return res.status(500).json({
        success: false,
        message: "Failed to upload to S3",
        error: s3Error.message,
      });
    }

    const fileRecord = new ProjectFile({
      originalName,
      storedName: path.basename(s3Key),
      fileType,
      mimeType,
      fileSize,
      s3Key,
      s3Bucket: process.env.S3_BUCKET_NAME,
      project: projectId,
      uploadedBy: userId,
      lastModifiedBy: userId,
      description: description || "",
      tags: tags
        ? Array.isArray(tags)
          ? tags
          : tags
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag)
        : [],
      folder: folderId,
    });

    await fileRecord.save();

    project.uploadedFiles.push(fileRecord._id);
    await project.updateStorageSize();
    await project.save();

    res.status(201).json({
      success: true,
      message: "File created successfully",
      file: fileRecord.getPublicData(),
    });
  } catch (error) {
    console.error("CreateFile error:", error);
    res.status(500).json({
      success: false,
      message: "File creation failed",
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
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    // Validate project
    const project = await Project.findById(projectId);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
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
      return res
        .status(403)
        .json({ success: false, message: "Permission denied" });
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
      .select(
        "originalName fileType mimeType fileSize folder uploadedBy uploadedAt description tags"
      )
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

// GET /api/folders/project/:projectId
exports.GetFoldersNew = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || req.user?._id; // Fixed: Added optional chaining

    // Check if user is authenticated
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
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
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    if (!projectId) {
      return res
        .status(400)
        .json({ success: false, message: "Project ID required" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    const canRead =
      project.owner.toString() === userId.toString() ||
      project.collaborators.some(
        (collab) =>
          collab.user.toString() === userId.toString() &&
          collab.permissions.includes("read")
      );
    if (!canRead) {
      return res
        .status(403)
        .json({ success: false, message: "Permission denied" });
    }

    const query =
      folderId === "root"
        ? { parent: null, project: projectId }
        : { parent: folderId, project: projectId };

    const subfolders = await ProjectFolder.find(query)
      .select("name parent createdBy createdAt")
      .populate("createdBy", "username")
      .lean();

    console.log(
      `Fetched ${subfolders.length} subfolders for folderId: ${folderId}, projectId: ${projectId}`
    );

    res.status(200).json({
      success: true,
      subfolders,
    });
  } catch (error) {
    console.error("Get folder contents error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch folder contents",
        error: error.message,
      });
  }
};

// POST /api/folders/create
exports.CreateFolderNew = async (req, res) => {
  try {
    const { name, parentId, projectId } = req.body;
    const userId = req.user?.id || req.user?._id; // Fixed: Added optional chaining

    // Check if user is authenticated
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
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
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
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
    const downloadUrl = await s3Service.getDownloadUrl(
      file.s3Key,
      // "getObject",
      // 3600, // 1 hour expiry
      // {
      //   "Content-Disposition": `attachment; filename="${file.originalName}"`,
      // }
      3600
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
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
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
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
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
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
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
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
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
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
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