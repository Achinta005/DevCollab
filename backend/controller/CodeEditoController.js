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
const HybridExecutionService = require("../services/HybridExecutionService");
const executionService = new HybridExecutionService();

exports.GetFileContent = async (req, res) => {
  try {
    console.log(
      `Fetch GetFileContent Hit on /files/:fileId/content for fileId: ${req.params.fileId}`
    );
    const { fileId } = req.params;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    // Find file
    const file = await ProjectFile.findById(fileId)
      .populate("project", "name owner collaborators")
      .populate("uploadedBy", "username firstname lastname fullName")
      .populate("lastModifiedBy", "username firstname lastname fullName");

    if (!file || !file.isActive) {
      console.log(`File not found or inactive: ${fileId}`);
      return res
        .status(404)
        .json({ success: false, message: "File not found or inactive" });
    }

    // Log file details for debugging
    console.log("File details:", {
      id: file._id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileType: file.fileType,
      s3Key: file.s3Key,
      s3Bucket: file.s3Bucket,
      lastModifiedBy: file.lastModifiedBy ? file.lastModifiedBy._id : "Not set",
    });

    // Check access permissions
    const project = file.project;
    const hasAccess =
      project.owner.toString() === userId.toString() ||
      project.collaborators.some(
        (collab) => collab.user.toString() === userId.toString()
      );

    if (!hasAccess) {
      console.log(`Access denied for user ${userId} on file ${fileId}`);
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Define supported MIME types
    const textMimeTypes = [
      "text/plain",
      "text/javascript",
      "application/json",
      "text/html",
      "text/css",
      "application/x-python-code",
    ];

    // Fallback to extension-based MIME type
    const fileExtension = file.fileType.toLowerCase();
    const extensionToMime = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".json": "application/json",
      ".css": "text/css",
      ".txt": "text/plain",
      ".py": "application/x-python-code",
      ".pdf": "application/pdf",
    };
    const effectiveMimeType = textMimeTypes.includes(file.mimeType)
      ? file.mimeType
      : extensionToMime[fileExtension] || file.mimeType;

    if (
      !textMimeTypes.includes(effectiveMimeType) &&
      effectiveMimeType !== "application/pdf"
    ) {
      console.log(
        `Unsupported file type: ${effectiveMimeType} for file ${file.originalName}`
      );
      return res.status(400).json({
        success: false,
        message: `File type (${effectiveMimeType}) not supported for editing in code editor`,
      });
    }

    // For PDFs, return a presigned URL
    if (effectiveMimeType === "application/pdf") {
      const downloadUrl = await s3.generatePresignedUrl(
        file.s3Bucket,
        file.s3Key,
        "getObject",
        3600, // 1 hour expiry
        {
          "Content-Disposition": `inline; filename="${file.originalName}"`,
        }
      );
      console.log(`Generated presigned URL for PDF: ${file.originalName}`);
      return res.json({
        success: true,
        downloadUrl,
        fileType: file.fileType,
      });
    }

    // Fetch file content from S3 for text files
    const s3Params = {
      Bucket: file.s3Bucket,
      Key: file.s3Key,
    };

    try {
      const s3Object = await s3.getObject(s3Params).promise();
      let content;
      try {
        content = s3Object.Body.toString("utf-8");
      } catch (decodeError) {
        console.error(
          `Failed to decode file content as UTF-8 for ${file.originalName}:`,
          decodeError
        );
        return res.status(500).json({
          success: false,
          message: `Failed to decode file content: ${decodeError.message}`,
        });
      }

      res.json({
        success: true,
        content,
        fileType: file.fileType,
      });
    } catch (s3Error) {
      console.error(`S3 fetch error for file ${file.originalName}:`, s3Error);
      return res.status(500).json({
        success: false,
        message: `Failed to fetch file content from S3: ${s3Error.message}`,
        errorCode: s3Error.code,
      });
    }
  } catch (error) {
    console.error(
      `Get file content error for fileId ${req.params.fileId}:`,
      error
    );
    res.status(500).json({
      success: false,
      message: `Failed to fetch file content: ${error.message}`,
    });
  }
};

exports.UpdateFileContent = async (req, res) => {
  try {
    console.log(
      `UpdateFileContent hit on PUT /files/:fileId/content for fileId: ${req.params.fileId}`
    );
    const { fileId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      console.log("Authentication failed: No user ID");
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    if (typeof content !== "string") {
      console.log("Invalid content type:", typeof content);
      return res
        .status(400)
        .json({ success: false, message: "Content must be a string" });
    }

    // Find file
    const file = await ProjectFile.findById(fileId)
      .populate("project", "name owner collaborators usedStorage")
      .populate("uploadedBy", "username firstname lastname fullName")
      .populate("lastModifiedBy", "username firstname lastname fullName");

    if (!file || !file.isActive) {
      console.log(`File not found or inactive: ${fileId}`);
      return res
        .status(404)
        .json({ success: false, message: "File not found or inactive" });
    }

    // Log file details for debugging
    console.log("File details for update:", {
      id: file._id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileType: file.fileType,
      s3Key: file.s3Key,
      s3Bucket: file.s3Bucket,
      lastModifiedBy: file.lastModifiedBy ? file.lastModifiedBy._id : "Not set",
    });

    // Check access permissions
    const project = file.project;
    const hasAccess =
      project.owner.toString() === userId.toString() ||
      project.collaborators.some(
        (collab) =>
          collab.user.toString() === userId.toString() &&
          collab.permissions.includes("edit_files")
      );

    if (!hasAccess) {
      console.log(`Access denied for user ${userId} on file ${fileId}`);
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Define supported MIME types for text editing
    const textMimeTypes = [
      "text/plain",
      "text/javascript",
      "application/json",
      "text/html",
      "text/css",
      "application/x-python-code",
    ];

    // Fallback to extension-based MIME type
    const fileExtension = file.fileType.toLowerCase();
    const extensionToMime = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".json": "application/json",
      ".css": "text/css",
      ".txt": "text/plain",
      ".py": "application/x-python-code",
    };
    const effectiveMimeType = textMimeTypes.includes(file.mimeType)
      ? file.mimeType
      : extensionToMime[fileExtension] || file.mimeType;

    if (!textMimeTypes.includes(effectiveMimeType)) {
      console.log(`Unsupported file type: ${effectiveMimeType}`);
      return res.status(400).json({
        success: false,
        message: `File type (${effectiveMimeType}) not supported for content update`,
      });
    }

    // Calculate new file size
    const newSize = Buffer.byteLength(content, "utf-8");
    const sizeDiff = newSize - file.fileSize;

    if (sizeDiff > 0 && !project.hasStorageSpace(sizeDiff)) {
      console.log("Storage quota exceeded");
      return res
        .status(400)
        .json({ success: false, message: "Storage quota exceeded" });
    }

    // Update content in S3
    const s3Params = {
      Bucket: file.s3Bucket,
      Key: file.s3Key,
      Body: content,
      ContentType: file.mimeType,
    };

    try {
      await s3.putObject(s3Params).promise();
      console.log(`Successfully updated S3 object for ${file.originalName}`);
    } catch (s3Error) {
      console.error(`S3 update error for file ${file.originalName}:`, s3Error);
      return res.status(500).json({
        success: false,
        message: `Failed to update file in S3: ${s3Error.message}`,
        errorCode: s3Error.code,
      });
    }

    // Update file record
    file.fileSize = newSize;
    file.lastModifiedBy = userId;
    file.updatedAt = new Date();
    await file.save();

    // Update project storage usage
    project.usedStorage += sizeDiff;
    await project.save();

    res.json({
      success: true,
      message: "File content updated successfully",
    });
  } catch (error) {
    console.error(
      `Update file content error for fileId ${req.params.fileId}:`,
      error
    );
    res.status(500).json({
      success: false,
      message: `Failed to update file content: ${error.message}`,
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

exports.ExecuteCode = async (req, res) => {
  try {
    const { fileName, content, input, projectId } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Validate input
    if (!fileName || !content) {
      return res.status(400).json({
        success: false,
        message: "fileName and content are required",
      });
    }

    // Get file extension
    const ext = fileName.split(".").pop().toLowerCase();
    const supportedTypes = ["py", "js", "java", "c", "cpp", "cc", "cxx"];

    if (!supportedTypes.includes(ext)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported file type: .${ext}. Supported types: ${supportedTypes.join(
          ", "
        )}`,
      });
    }

    console.log(`Executing ${fileName} for user ${userId}`);

    // Execute code using hybrid service (Judge0 + local fallback)
    const result = await executionService.executeCode(
      content,
      fileName,
      input || ""
    );

    // Log execution result
    console.log(
      `Execution completed - Success: ${result.success}, Status: ${result.status}`
    );

    // Return result
    res.json({
      success: result.success,
      output: result.output || "",
      error: result.error || "",
      status: result.status,
      executionTime: result.executionTime,
      memoryUsage: result.memoryUsage,
      metadata: {
        language: ext,
        fileName: fileName,
        userId: userId,
        timestamp: new Date().toISOString(),
        executionMethod:
          result.executionTime &&
          result.executionTime.includes("s") &&
          parseFloat(result.executionTime) < 5
            ? "local"
            : "judge0",
      },
    });
  } catch (error) {
    console.error("Code execution error:", error);

    res.status(500).json({
      success: false,
      error: "Code execution failed",
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Please try again or contact support",
    });
  }
};

exports.ExecuteHealthCheck = async (req, res) => {
  try {
    const availableExecutors = await executionService.getAvailableExecutors();

    const status = {
      judge0: availableExecutors.judge0,
      localExecutors: availableExecutors.local,
      overallHealth:
        availableExecutors.judge0 ||
        Object.values(availableExecutors.local).some(Boolean),
    };

    res.json({
      success: true,
      status: status,
      message: status.overallHealth
        ? "Execution service is healthy"
        : "No execution methods available",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to check execution service health",
      error: error.message,
    });
  }
};

exports.GetSupportedLanguages = async (req, res) => {
  try {
    const languages = {
      py: { name: "Python", version: "3.8.1", id: 71 },
      js: { name: "JavaScript (Node.js)", version: "12.14.0", id: 63 },
      java: { name: "Java", version: "OpenJDK 13.0.1", id: 62 },
      cpp: { name: "C++", version: "GCC 9.2.0", id: 54 },
      c: { name: "C", version: "GCC 9.2.0", id: 50 },
      cs: { name: "C#", version: "Mono 6.6.0.161", id: 51 },
      php: { name: "PHP", version: "7.4.1", id: 68 },
      rb: { name: "Ruby", version: "2.7.0", id: 72 },
      go: { name: "Go", version: "1.13.5", id: 60 },
      rs: { name: "Rust", version: "1.40.0", id: 73 },
      kt: { name: "Kotlin", version: "1.3.70", id: 78 },
      swift: { name: "Swift", version: "5.2.3", id: 83 },
      ts: { name: "TypeScript", version: "3.7.4", id: 74 },
    };

    res.json({
      success: true,
      languages: languages,
      count: Object.keys(languages).length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to get supported languages",
    });
  }
};