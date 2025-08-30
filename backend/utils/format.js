const express=require('express');
function formatFileSize(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (!bytes) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
}

module.exports = { formatFileSize };