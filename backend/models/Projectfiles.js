const mongoose = require("mongoose");

const ProjectFileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  storedName: { type: String, required: true },
  fileType: { type: String, required: true },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true },

  s3Key: { type: String, required: true },
  s3Bucket: { type: String, required: true },

  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  folder: { type: mongoose.Schema.Types.ObjectId, ref: "ProjectFolder", default: null }, // folder reference
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  description: { type: String, maxlength: 500 },
  tags: [{ type: String, maxlength: 50 }],

  downloadCount: { type: Number, default: 0 },
  lastAccessed: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  isPublic: { type: Boolean, default: false },

  processingStatus: { type: String, enum: ["pending","completed","failed"], default: "completed" },
}, { timestamps: true });

// Indexes
ProjectFileSchema.index({ project: 1, folder: 1, isActive: 1 });
ProjectFileSchema.index({ uploadedBy: 1 });
ProjectFileSchema.index({ s3Key: 1 });
ProjectFileSchema.index({ fileType: 1 });
ProjectFileSchema.index({ createdAt: -1 });

// Methods
ProjectFileSchema.methods.getPublicData = function() {
  return {
    id: this._id,
    originalName: this.originalName,
    fileType: this.fileType,
    mimeType: this.mimeType,
    fileSize: this.fileSize,
    description: this.description || '',
    tags: this.tags || [],
    folder: this.folder,
    downloadCount: this.downloadCount,
    uploadedAt: this.createdAt,
    uploadedBy: this.uploadedBy
  };
};

ProjectFileSchema.methods.recordDownload = async function() {
  this.downloadCount += 1;
  this.lastAccessed = new Date();
  return this.save();
};

ProjectFileSchema.methods.isImage = function() {
  return [".jpg",".jpeg",".png",".gif",".svg",".webp",".bmp"].includes(this.fileType.toLowerCase());
};

ProjectFileSchema.statics.getReadableFileSize = function(bytes) {
  const sizes = ["Bytes","KB","MB","GB","TB"];
  if (!bytes) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024,i))*100)/100 + " " + sizes[i];
};

// Virtual for download URL
ProjectFileSchema.virtual("downloadUrl").get(function() { return null; });

module.exports = mongoose.model("ProjectFile", ProjectFileSchema);
