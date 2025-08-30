const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    collaborators: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        role: {
          type: String,
          enum: ["owner", "editor", "viewer", "commenter"],
          default: "viewer",
        },
        permissions: [
          {
            type: String,
            enum: ["read", "write", "delete", "manage_collaborators", "manage_settings"],
          },
        ],
        joinedAt: { type: Date, default: Date.now },
      },
    ],

    uploadedFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: "ProjectFile" }],
    folders: [{ type: mongoose.Schema.Types.ObjectId, ref: "ProjectFolder" }],

    fileStorage: {
      totalSizeBytes: { type: Number, default: 0 },
      maxSizeBytes: { type: Number, default: 100 * 1024 * 1024 }, // 100MB
      allowedTypes: {
        type: [String],
        default: [
          ".pdf",".doc",".docx",".txt",".jpg",".png",".gif",".svg",
          ".zip",".py",".js",".html",".css"
        ],
      },
    },

    settings: {
      visibility: { type: String, enum: ["private","public","unlisted"], default: "private" },
      allowedLanguages: [{ type: String }],
      maxCollaborators: { type: Number, default: 10 },
      filePermissions: {
        whoCanUpload: { type: String, enum: ["owner_only","collaborators","everyone"], default: "collaborators" },
        whoCanDelete: { type: String, enum: ["owner_only","uploader_and_owner","collaborators"], default: "uploader_and_owner" },
      },
    },

    inviteCode: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

// Methods
ProjectSchema.methods.canUserUploadFiles = function(userId) {
  const userIdStr = userId.toString();
  if (this.owner.toString() === userIdStr) return true;

  const uploadPermission = this.settings.filePermissions.whoCanUpload;
  if (uploadPermission === "everyone") return true;
  if (uploadPermission === "owner_only") return false;

  return this.collaborators.some(collab => collab.user.toString() === userIdStr);
};

ProjectSchema.methods.canUserDeleteFile = function(userId, fileUploaderId) {
  const userIdStr = userId.toString();
  if (this.owner.toString() === userIdStr) return true;

  const deletePermission = this.settings.filePermissions.whoCanDelete;
  if (deletePermission === "owner_only") return false;
  if (deletePermission === "uploader_and_owner") return fileUploaderId.toString() === userIdStr;

  return this.collaborators.some(collab => collab.user.toString() === userIdStr);
};

ProjectSchema.methods.hasStorageSpace = function(fileSizeBytes) {
  return (this.fileStorage.totalSizeBytes || 0) + fileSizeBytes <= this.fileStorage.maxSizeBytes;
};

ProjectSchema.methods.updateStorageSize = async function() {
  const ProjectFile = mongoose.model("ProjectFile");
  const result = await ProjectFile.aggregate([
    { $match: { project: this._id, isActive: true } },
    { $group: { _id: null, totalSize: { $sum: "$fileSize" } } },
  ]);
  this.fileStorage.totalSizeBytes = result.length ? result[0].totalSize : 0;
  return this.save();
};

ProjectSchema.methods.generateInviteCode = function() {
  const code = Math.random().toString(36).substring(2,8).toUpperCase();
  this.inviteCode = code;
  return code;
};

// Indexes
ProjectSchema.index({ owner: 1 });
ProjectSchema.index({ "collaborators.user": 1 });
ProjectSchema.index({ name: "text", description: "text" });

module.exports = mongoose.model("Project", ProjectSchema);