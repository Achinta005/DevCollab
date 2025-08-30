const express = require("express");
const multer = require("multer");
const s3Service = require("../services/s3Service");
const authMiddleware = require("../middleware/auth");
const router = express.Router();

// Import controller
const {
  FileUpload,
  GetFiles_for_Project,
  GetCategories,
  GetDownloadURL,
  DeleteFile,
  UpdateFiles,
  GetFiles,
  GetFoldersNew,
  GetFolderContent,
  CreateFolderNew,
  DeleteFolder,
  RenameFile,
  RenameFolder,
} = require("../controller/FileController");

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    try {
      s3Service.validateFile(file);
      cb(null, true);
    } catch (error) {
      cb(error, false);
    }
  },
});

router.use(authMiddleware);

// Folder Routes
router.post("/folders/create", CreateFolderNew);
router.get("/folders/project/:projectId", GetFoldersNew);//<----
router.get("/folders/:folderId/contents", GetFolderContent);
router.delete("/folders/:folderId", DeleteFolder);
router.patch("/folders/:folderId/rename", RenameFolder);

// File Routes
router.get("/files/project/:projectId", GetFiles_for_Project);
router.get("/files/project/:projectId/categories", GetCategories);
router.get("/files/:fileId/download", GetDownloadURL);
router.get("/files/:fileId", GetFiles);
router.post("/files/upload/:projectId", upload.single("file"), FileUpload);
router.patch("/files/:fileId", UpdateFiles);
router.patch("/files/:fileId/rename", RenameFile);
router.delete("/files/:fileId", DeleteFile);
router.delete("/files/bulk/:projectId", DeleteFile); // For bulk deletion

module.exports = router;