const express = require("express");
const multer = require("multer");
const s3Service = require("../services/s3Service");
const authMiddleware = require("../middleware/auth");
const router = express.Router();

router.use(authMiddleware)
router.use(express.json())

const {GetFileContent,UpdateFileContent,DeleteFile,ExecuteCode,ExecuteHealthCheck,GetSupportedLanguages}=require('../controller/CodeEditoController')

router.get("/:fileId/content", GetFileContent);
router.put("/:fileId/content/submit", UpdateFileContent);
router.delete("/:fileId/delete/editorFiles", DeleteFile);
router.post('/execute', ExecuteCode);
router.get('/execute/health', ExecuteHealthCheck);
router.get('/execute/languages', GetSupportedLanguages)

module.exports = router;