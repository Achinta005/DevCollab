const express = require("express");
const multer = require("multer");
const s3Service = require("../services/s3Service");
const authMiddleware = require("../middleware/auth");
const router = express.Router();

// Import controller
const {
  FileUpload,
  GetFiles_for_Project,
  GetDownloadURL,
  DeleteFile,
  GetFileContent,
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

// Api Endpoint for FileManager.js
router.post("/folders/create", CreateFolderNew);//createFolder
router.post("/upload/:projectId", upload.single("file"), FileUpload);//uploadFiles
router.get("/:fileId/download", GetDownloadURL);//downloadFile
router.delete("/folders/:folderId/delete", DeleteFolder);//deleteFolder
router.delete("/:fileId/delete", DeleteFile);//deleteFiles
router.delete("/bulk/:projectId/delete", DeleteFile); // deleteFiles Bulk
router.patch("/:folderId/rename/folders", RenameFolder);//renameItemApi Folder
router.patch("/:fileId/rename/files", RenameFile);//renameItemApi File

// Api Endpoint for FileManagerContext.js
router.get("/folders/project/:projectId", GetFoldersNew);//fetchFolders
router.get("/folders/:folderId/contents", GetFolderContent);//fetchFolderContents (1'st Api Call) and  fetchAllFiles (1'st Api Call)
router.get("/project/:projectId", GetFiles_for_Project);//fetchFolderContents (2'nd Api Call) and fetchAllFiles (2'nd Api Call)

//Api Endpoint for CodeEditor.js
router.get("/:fileId/content", GetFileContent);//<----------------------------------------------FIX

module.exports = router;