const mongoose = require("mongoose");

const ProjectFolderSchema = new mongoose.Schema({
  name: { type: String, required: true },              // folder name
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "ProjectFolder", default: null }, // null = root
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

// Virtual for full path
ProjectFolderSchema.virtual("fullPath").get(async function() {
  if (!this.parent) return this.name;
  const parentFolder = await mongoose.model("ProjectFolder").findById(this.parent);
  return parentFolder ? parentFolder.fullPath + "/" + this.name : this.name;
});

// Indexes
ProjectFolderSchema.index({ project: 1, parent: 1 });

module.exports = mongoose.model("ProjectFolder", ProjectFolderSchema);