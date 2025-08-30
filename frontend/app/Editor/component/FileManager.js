import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Upload,
  FolderPlus,
  File,
  Folder,
  Download,
  Trash2,
  Edit3,
  Grid,
  List,
  Search,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw,
  ChevronRight,
  FolderOpen,
  Image,
  FileText,
  Music,
  Video,
  Archive,
  Code,
  Home,
  ArrowLeft,
  MoreVertical,
  Loader,
} from "lucide-react";
import { debounce } from "lodash"; // Explicitly import debounce
import { useFileManager } from "../../context/FileManagerContext";
import { projectService } from "../../../services";

export const getFileIcon = (category, name, size = "w-8 h-8") => {
  if (category === "folder") {
    return <Folder className={`${size} text-green-500`} />;
  }

  const extension = name?.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "svg":
    case "webp":
      return <Image className={`${size} text-green-500`} />;
    case "mp4":
    case "avi":
    case "mov":
    case "webm":
      return <Video className={`${size} text-purple-500`} />;
    case "mp3":
    case "wav":
    case "flac":
    case "aac":
      return <Music className={`${size} text-pink-500`} />;
    case "zip":
    case "rar":
    case "7z":
    case "tar":
      return <Archive className={`${size} text-orange-500`} />;
    case "js":
    case "tsx":
    case "py":
    case "java":
    case "cpp":
      return <Code className={`${size} text-cyan-500`} />;
    case "pdf":
    case "doc":
    case "docx":
    case "txt":
      return <FileText className={`${size} text-red-500`} />;
    default:
      return <File className={`${size} text-gray-500`} />;
  }
};

const FileManager = ({ projectData }) => {
  // Context
  const {
    folders,
    fetchFolderContents,
    fetchFolders,
    setError,
    API_BASE,
    getAuthHeaders,
  } = useFileManager();

  // Navigation state
  const [currentPath, setCurrentPath] = useState([
    { name: "root", id: "root" },
  ]);
  const [viewMode, setViewMode] = useState("grid");
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameItem, setRenameItem] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, seterror] = useState("");

  // API integration state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState("root");
  const [selectedUploadFolder, setSelectedUploadFolder] = useState("root");
  const [currentFolderContents, setCurrentFolderContents] = useState({
    folders: [],
    files: [],
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [fetchProject, setFetchProject] = useState({});

  // Configuration
  const projectId = projectData?.id;

  // Helper functions
  const getFileIcon = (category, name, size = "w-8 h-8") => {
    if (category === "folder") {
      return <Folder className={`${size} text-blue-500`} />;
    }

    const extension = name?.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "svg":
      case "webp":
        return <Image className={`${size} text-green-500`} />;
      case "mp4":
      case "avi":
      case "mov":
      case "webm":
        return <Video className={`${size} text-purple-500`} />;
      case "mp3":
      case "wav":
      case "flac":
      case "aac":
        return <Music className={`${size} text-pink-500`} />;
      case "zip":
      case "rar":
      case "7z":
      case "tar":
        return <Archive className={`${size} text-orange-500`} />;
      case "js":
      case "tsx":
      case "py":
      case "java":
      case "cpp":
        return <Code className={`${size} text-cyan-500`} />;
      case "pdf":
      case "doc":
      case "docx":
      case "txt":
        return <FileText className={`${size} text-red-500`} />;
      default:
        return <File className={`${size} text-gray-500`} />;
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // API functions
  const createFolder = async (name, parentId = "root") => {
    if (!projectId) {
      setError("Project ID is missing");
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/folders/create`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name,
          parentId,
          projectId,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create folder");
      }

      setSuccess(`Folder "${name}" created successfully`);
      setShowNewFolderModal(false);
      await Promise.all([
        fetchFolders(),
        fetchFolderContentsWrapper(currentFolder),
      ]);
    } catch (error) {
      setError(error.message);
      console.error("Create folder error:", error);
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async (filesToUpload, folderId = "root") => {
    if (!filesToUpload?.length) return;
    if (!projectId) {
      setError("Project ID is missing");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folderId);

        const response = await fetch(`${API_BASE}/upload/${projectId}`, {
          method: "POST",
          headers: {
            Authorization: getAuthHeaders().Authorization,
          },
          body: formData,
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || `Failed to upload ${file.name}`);
        }

        setUploadProgress(((i + 1) / filesToUpload.length) * 100);
      }

      setSuccess(`Successfully uploaded ${filesToUpload.length} file(s)`);
      setShowUploadModal(false);
      await Promise.all([
        fetchFolders(),
        fetchFolderContentsWrapper(currentFolder),
      ]);
    } catch (error) {
      setError(error.message);
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const downloadFile = async (fileId, fileName) => {
    try {
      const response = await fetch(`${API_BASE}/${fileId}/download`, {
        headers: getAuthHeaders(),
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.downloadUrl) {
        throw new Error(data.message || "Failed to get download URL");
      }

      const link = document.createElement("a");
      link.href = data.downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      setError(`Failed to download ${fileName}: ${error.message}`);
      console.error("Download error:", error);
    }
  };

  const deleteFiles = async (fileIds) => {
    if (!fileIds?.length) return;
    try {
      setLoading(true);
      const response = await fetch(
        fileIds.length === 1
          ? `${API_BASE}/${fileIds[0]}/delete`
          : `${API_BASE}/bulk/${projectId}/delete`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
          body: fileIds.length > 1 ? JSON.stringify({ fileIds }) : undefined,
        }
      );

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to delete file(s)");
      }

      setSuccess(`Successfully deleted ${fileIds.length} file(s)`);
      setSelectedItems(new Set());
      await fetchFolderContentsWrapper(currentFolder);
    } catch (error) {
      setError(error.message);
      console.error("Delete files error:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteFolder = async (folderId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/folders/${folderId}/delete`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to delete folder");
      }

      setSuccess("Folder deleted successfully");
      setSelectedItems(new Set());
      await Promise.all([
        fetchFolders(),
        fetchFolderContentsWrapper(currentFolder),
      ]);
    } catch (error) {
      setError(error.message);
      console.error("Delete folder error:", error);
    } finally {
      setLoading(false);
    }
  };

  const renameItemApi = async (itemId, newName, isFolder) => {
    try {
      setLoading(true);
      const endpoint = isFolder
        ? `${API_BASE}/${itemId}/rename/folders`
        : `${API_BASE}/${itemId}/rename/files`;
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: newName }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(
          data.message || `Failed to rename ${isFolder ? "folder" : "file"}`
        );
      }

      setSuccess(`Successfully renamed ${isFolder ? "folder" : "file"}`);
      setShowRenameModal(false);
      setRenameItem(null);
      await Promise.all([
        fetchFolders(),
        fetchFolderContentsWrapper(currentFolder),
      ]);
    } catch (error) {
      setError(error.message);
      console.error("Rename error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Wrapper for fetchFolderContents to update local state
  const fetchFolderContentsWrapper = async (folderId) => {
    setLoading(true);
    try {
      const contents = await fetchFolderContents(folderId);
      setCurrentFolderContents(contents || { folders: [], files: [] });
      setPagination(contents?.pagination || {});
    } catch (error) {
      setError(error.message);
      console.error("Fetch folder contents error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Event Handlers
  const handleFolderClick = (folder) => {
    if (!folder?._id) return;
    setCurrentFolder(folder._id);
    setCurrentPath([...currentPath, { name: folder.name, id: folder._id }]);
    setCurrentPage(1); // Reset page on folder change
    fetchFolderContentsWrapper(folder._id);
  };

  const handleBreadcrumbClick = (index) => {
    const newPath = currentPath.slice(0, index + 1);
    setCurrentPath(newPath);
    const folderId = newPath[index].id;
    setCurrentFolder(folderId);
    setCurrentPage(1); // Reset page on navigation
    fetchFolderContentsWrapper(folderId);
  };

  const handleItemSelect = (itemId, event) => {
    event.stopPropagation();
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      if (!event.ctrlKey && !event.metaKey) {
        newSelected.clear();
      }
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleRename = (item, isFolder) => {
    setRenameItem({ ...item, isFolder });
    setShowRenameModal(true);
  };

  // Drag & Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await uploadFiles(files, currentFolder);
    }
  };

  const handleFileUpload = (files) => {
    if (files?.length > 0) {
      uploadFiles(Array.from(files), selectedUploadFolder);
    }
  };

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearchTerm(value);
      setCurrentPage(1); // Reset page on search
    }, 300),
    []
  );

  // Filter files and folders
  const filteredFiles = useMemo(() => {
    return (currentFolderContents.files || []).filter((file) =>
      file.originalName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [currentFolderContents.files, searchTerm]);

  const filteredFolders = useMemo(() => {
    return (currentFolderContents.folders || []).filter((folder) =>
      folder.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [currentFolderContents.folders, searchTerm]);

  // Load initial data
  useEffect(() => {
    if (projectId) {
      fetchFolderContentsWrapper(currentFolder);
    }
  }, [projectId, currentFolder, currentPage]);

  //FETCH PROJECT METADATA FROM DATABASE USING PROJECT ID
  const fetchProjectMetaData = async () => {
    try {
      const response = projectService.getProject(projectData.id);
      const data = await response;
      if (data.success) {
        return data.data;
      }
    } catch (error) {}
  };
  useEffect(() => {
    const loadProject = async () => {
      try {
        const data = await fetchProjectMetaData();
        setFetchProject(data);
      } catch (err) {
        setFetchProject(null);
      }
    };

    loadProject();
  }, []);

  // Auto-hide messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Components
  const NotificationBar = () => {
    if (!success && !error) return null;

    return (
      <div
        className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-md ${
          success
            ? "bg-green-100 border border-green-400 text-green-700"
            : "bg-red-100 border border-red-400 text-red-700"
        }`}
        role="alert"
      >
        <div className="flex items-start">
          {success ? (
            <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-medium">{success || error}</p>
          </div>
          <button
            onClick={() => {
              setSuccess(null);
              setError(null);
            }}
            className="ml-2 text-gray-400 hover:text-gray-600"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const Breadcrumb = () => (
    <nav className="flex items-center space-x-2 mb-6" aria-label="Breadcrumb">
      <button
        onClick={() => handleBreadcrumbClick(0)}
        className="p-2 cursor-pointer rounded-lg transition-colors text-amber-400"
        aria-label="Go to root folder"
      >
        <Home className="w-4 h-4" />
      </button>
      {currentPath.length > 1 && (
        <button
          onClick={() => {
            const newPath = currentPath.slice(0, -1);
            setCurrentPath(newPath);
            setCurrentFolder(newPath[newPath.length - 1].id);
            setCurrentPage(1);
            fetchFolderContentsWrapper(newPath[newPath.length - 1].id);
          }}
          className="p-2 hover:bg-amber-800/40 cursor-pointer rounded-lg transition-colors text-amber-400"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-center space-x-2">
        {currentPath.map((path, index) => (
          <React.Fragment key={path.id}>
            <span
              className={`px-3 py-1 rounded-lg capitalize cursor-pointer ${
                index === currentPath.length - 1
                  ? "bg-amber-800/40 text-amber-200 rounded text-sm border border-amber-600/30"
                  : "hover:bg-amber-800/40 text-amber-200 text-sm "
              }`}
              onClick={() => handleBreadcrumbClick(index)}
              role="link"
              tabIndex={0}
              onKeyPress={(e) =>
                e.key === "Enter" && handleBreadcrumbClick(index)
              }
            >
              {path.name === "root" ? "Home" : path.name}
            </span>
            {index < currentPath.length - 1 && (
              <ChevronRight className="w-4 h-4 text-amber-400" />
            )}
          </React.Fragment>
        ))}
      </div>
    </nav>
  );

  const ToolBar = () => (
    <div className="flex items-center justify-between mb-6 p-4 bg-amber-800/40 text-xs border border-amber-600/30 rounded-xl shadow-sm">
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setShowNewFolderModal(true)}
          className="flex items-center space-x-2 px-4 py-2 text-amber-300 bg-amber-800/70 hover:bg-amber-800/90 rounded-lg cursor-pointer transition-all transform hover:scale-105"
          aria-label="Create new folder"
        >
          <FolderPlus className="w-4 h-4" />
          <span>New Folder</span>
        </button>

        <button
          onClick={() => setShowUploadModal(true)}
          disabled={isUploading}
          className="flex items-center space-x-2 px-4 py-2 text-amber-300 bg-amber-800/70 hover:bg-amber-800/90 rounded-lg cursor-pointer transition-all transform hover:scale-105"
          aria-label="Upload files"
        >
          {isUploading ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span>{isUploading ? "Uploading..." : "Upload Files"}</span>
        </button>

        <button
          onClick={() => {
            fetchFolders();
            fetchFolderContentsWrapper(currentFolder);
          }}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 text-amber-300 bg-amber-800/70 hover:bg-amber-800/90 rounded-lg cursor-pointer transition-all transform hover:scale-105"
          aria-label="Refresh content"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>

        <div className="h-6 w-px bg-gray-300 mx-2" />

        <div
          className="flex items-center bg-amber-700/40 rounded-lg p-1"
          role="group"
          aria-label="View mode"
        >
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded ${
              viewMode === "grid" ? "bg-amber-400 shadow-sm" : ""
            }`}
            aria-label="Grid view"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded ${
              viewMode === "list" ? "bg-amber-400 shadow-sm" : ""
            }`}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-amber-400" />
          <input
            type="text"
            placeholder="Search files and folders..."
            onChange={(e) => debouncedSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-100 text-amber-300"
            aria-label="Search files and folders"
          />
        </div>
      </div>
    </div>
  );

  const ContextMenu = ({ item, isFolder, onClose }) => {
    const isSelected = selectedItems.has(
      isFolder ? `folder-${item._id}` : item.id
    );

    return (
      <div className="absolute bg-white border rounded-lg shadow-lg p-2 z-50">
        {!isSelected && (
          <button
            onClick={() => {
              handleItemSelect(isFolder ? `folder-${item._id}` : item.id, {
                ctrlKey: true,
              });
              onClose();
            }}
            className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-100 w-full text-left"
          >
            <span>Select</span>
          </button>
        )}
        {!isFolder && (
          <button
            onClick={() => {
              downloadFile(item.id, item.originalName);
              onClose();
            }}
            className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-100 w-full text-left"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>
        )}
        <button
          onClick={() => {
            handleRename(item, isFolder);
            onClose();
          }}
          className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-100 w-full text-left"
        >
          <Edit3 className="w-4 h-4" />
          <span>Rename</span>
        </button>
        <button
          onClick={() => {
            if (
              window.confirm(
                `Delete ${isFolder ? "folder" : "file"} ${
                  isFolder ? item.name : item.originalName
                }?`
              )
            ) {
              if (isFolder) {
                deleteFolder(item._id);
              } else {
                deleteFiles([item.id]);
              }
              onClose();
            }
          }}
          className="flex items-center space-x-2 px-3 py-2 hover:bg-red-100 text-red-600 w-full text-left"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
        </button>
      </div>
    );
  };

  const GridView = () => {
    const [contextMenu, setContextMenu] = useState(null);

    const handleContextMenu = (e, item, isFolder) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setContextMenu({
        x: Math.min(x, window.innerWidth - 200), // Prevent overflow
        y: Math.min(y, window.innerHeight - 200),
        item,
        isFolder,
      });
    };

    const closeContextMenu = () => setContextMenu(null);

    return (
      <div className="p-6 bg-amber-800/20 rounded-xl shadow-md">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredFolders.map((folder) => (
            <div
              key={`folder-${folder._id}`}
              className={`group relative p-4 rounded-xl border-2 border-dashed border-transparent hover:border-amber-300 hover:bg-amber-100/50 transition-all cursor-pointer transform hover:scale-105 ${
                selectedItems.has(`folder-${folder._id}`)
                  ? "bg-amber-200/50 border-amber-400"
                  : "bg-white hover:shadow-lg"
              }`}
              onClick={() => handleFolderClick(folder)}
              onContextMenu={(e) => handleContextMenu(e, folder, true)}
              tabIndex={0}
              role="button"
              aria-label={`Folder ${folder.name}`}
              onKeyPress={(e) => e.key === "Enter" && handleFolderClick(folder)}
            >
              <div
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => handleItemSelect(`folder-${folder._id}`, e)}
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(`folder-${folder._id}`)}
                  readOnly
                  aria-label={`Select folder ${folder.name}`}
                />
              </div>

              <div className="flex flex-col items-center space-y-3">
                <div className="p-3 bg-amber-100/50 rounded-full">
                  <FolderOpen className="w-8 h-8 text-amber-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-amber-900 truncate w-full">
                    {folder.name}
                  </p>
                  <p className="text-xs text-amber-600">
                    {formatDate(folder.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {filteredFiles.map((file) => (
            <div
              key={`file-${file.id}`}
              className={`group relative p-4 rounded-xl border-2 border-dashed border-transparent hover:border-amber-300 hover:bg-amber-100/50 transition-all cursor-pointer transform hover:scale-105 ${
                selectedItems.has(file.id)
                  ? "bg-amber-200/50 border-amber-400"
                  : "bg-white hover:shadow-lg"
              }`}
              onDoubleClick={() => downloadFile(file.id, file.originalName)}
              onContextMenu={(e) => handleContextMenu(e, file, false)}
              tabIndex={0}
              role="button"
              aria-label={`File ${file.originalName}`}
              onKeyPress={(e) =>
                e.key === "Enter" && downloadFile(file.id, file.originalName)
              }
            >
              <div
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => handleItemSelect(file.id, e)}
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(file.id)}
                  readOnly
                  aria-label={`Select file ${file.originalName}`}
                />
              </div>

              <div className="flex flex-col items-center space-y-3">
                <div className="p-3 bg-amber-100/50 rounded-full">
                  {getFileIcon(
                    file.category,
                    file.originalName,
                    "w-8 h-8 text-amber-400"
                  )}
                </div>
                <div className="text-center">
                  <p className="font-medium text-amber-900 truncate w-full">
                    {file.originalName}
                  </p>
                  <p className="text-xs text-amber-600">
                    {formatFileSize(file.fileSize)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {contextMenu && (
            <div
              style={{ top: contextMenu.y, left: contextMenu.x }}
              className="fixed z-50"
            >
              <ContextMenu
                item={contextMenu.item}
                isFolder={contextMenu.isFolder}
                onClose={closeContextMenu}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const ListView = () => {
    const [contextMenu, setContextMenu] = useState(null);

    const handleContextMenu = (e, item, isFolder) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setContextMenu({
        x: Math.min(x, window.innerWidth - 200), // Prevent overflow
        y: Math.min(y, window.innerHeight - 200),
        item,
        isFolder,
      });
    };

    const closeContextMenu = () => setContextMenu(null);

    return (
      <div className="bg-amber-700/50 rounded-xl shadow-sm overflow-hidden text-amber-400">
        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-amber-700/20 font-medium text-amber-400">
          <div className="col-span-5">Name</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-2">Modified</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-1">Actions</div>
        </div>

        {filteredFolders.map((folder) => (
          <div
            key={`folder-${folder._id}`}
            className={`grid grid-cols-12 gap-4 p-4 border-b hover:bg-amber-700/10 cursor-pointer transition-colors ${
              selectedItems.has(`folder-${folder._id}`) ? "bg-amber-700/20" : ""
            }`}
            onClick={() => handleFolderClick(folder)}
            onContextMenu={(e) => handleContextMenu(e, folder, true)}
            tabIndex={0}
            role="button"
            aria-label={`Folder ${folder.name}`}
            onKeyPress={(e) => e.key === "Enter" && handleFolderClick(folder)}
          >
            <div className="col-span-5 flex items-center space-x-3">
              <input
                type="checkbox"
                checked={selectedItems.has(`folder-${folder._id}`)}
                onChange={(e) => handleItemSelect(`folder-${folder._id}`, e)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select folder ${folder.name}`}
                className="text-amber-400"
              />
              <FolderOpen className="w-6 h-6 text-amber-400" />
              <span className="font-medium">{folder.name}</span>
            </div>
            <div className="col-span-2 text-amber-400">—</div>
            <div className="col-span-2 text-amber-400">
              {formatDate(folder.createdAt)}
            </div>
            <div className="col-span-2 text-amber-400">Folder</div>
            <div className="col-span-1">
              <button
                className="p-1 hover:bg-amber-700/20 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  handleContextMenu(e, folder, true);
                }}
                aria-label="Folder actions"
              >
                <MoreVertical className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>
        ))}

        {filteredFiles.map((file) => (
          <div
            key={`file-${file.id}`}
            className={`grid grid-cols-12 gap-4 p-4 border-b hover:bg-amber-700/10 transition-colors ${
              selectedItems.has(file.id) ? "bg-amber-700/20" : ""
            }`}
            onDoubleClick={() => downloadFile(file.id, file.originalName)}
            onContextMenu={(e) => handleContextMenu(e, file, false)}
            tabIndex={0}
            role="button"
            aria-label={`File ${file.originalName}`}
            onKeyPress={(e) =>
              e.key === "Enter" && downloadFile(file.id, file.originalName)
            }
          >
            <div className="col-span-5 flex items-center space-x-3">
              <input
                type="checkbox"
                checked={selectedItems.has(file.id)}
                onChange={(e) => handleItemSelect(file.id, e)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select file ${file.originalName}`}
                className="text-amber-400"
              />
              {getFileIcon(
                file.category,
                file.originalName,
                "w-6 h-6 text-amber-400"
              )}
              <span className="font-medium">{file.originalName}</span>
            </div>
            <div className="col-span-2 text-amber-400">
              {formatFileSize(file.fileSize)}
            </div>
            <div className="col-span-2 text-amber-400">
              {formatDate(file.uploadedAt)}
            </div>
            <div className="col-span-2 text-amber-400 capitalize">
              {file.category}
            </div>
            <div className="col-span-1">
              <button
                className="p-1 hover:bg-amber-700/20 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  handleContextMenu(e, file, false);
                }}
                aria-label="File actions"
              >
                <MoreVertical className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>
        ))}

        {contextMenu && (
          <div
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 text-amber-400"
          >
            <ContextMenu
              item={contextMenu.item}
              isFolder={contextMenu.isFolder}
              onClose={closeContextMenu}
            />
          </div>
        )}
      </div>
    );
  };

  const UploadModal = () => {
    if (!showUploadModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div className="bg-amber-700/50 rounded-2xl p-6 w-full max-w-md mx-4 text-amber-400">
    <h3 className="text-xl font-bold mb-4">Upload Files</h3>

    <div className="mb-4">
      <label className="block text-sm font-medium text-amber-400 mb-2">
        Select Destination Folder
      </label>
      <select
        value={selectedUploadFolder}
        onChange={(e) => setSelectedUploadFolder(e.target.value)}
        disabled={isUploading}
        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent text-amber-400 bg-amber-700/20"
        aria-label="Select destination folder"
      >
        <option value="root">Root</option>
        {folders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {"  ".repeat(folder.level || 0)}
            {folder.fullPath || folder.name}
          </option>
        ))}
      </select>
    </div>

    <div
      className="border-2 border-dashed border-amber-400 rounded-xl p-8 text-center hover:border-amber-500 transition-colors cursor-pointer"
      onClick={() =>
        !isUploading && document.getElementById("fileInput").click()
      }
      role="button"
      aria-label="Upload files"
    >
      {isUploading ? (
        <div>
          <Loader className="w-12 h-12 mx-auto mb-4 text-amber-400 animate-spin" />
          <p className="text-amber-400 mb-2">Uploading files...</p>
          <div className="w-full bg-amber-700/20 rounded-full h-2">
            <div
              className="bg-amber-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-amber-400 mt-2">
            {uploadProgress}% complete
          </p>
        </div>
      ) : (
        <div>
          <Upload className="w-12 h-12 mx-auto mb-4 text-amber-400" />
          <p className="text-amber-400 mb-2">
            Drag and drop files here, or click to select
          </p>
          <p className="text-sm text-amber-400">Supports all file types</p>
        </div>
      )}
    </div>

    <input
      id="fileInput"
      type="file"
      multiple
      className="hidden"
      onChange={(e) => handleFileUpload(e.target.files)}
      disabled={isUploading}
      aria-label="File input"
    />

    <div className="flex justify-end space-x-3 mt-6">
      <button
        onClick={() => setShowUploadModal(false)}
        disabled={isUploading}
        className="px-4 py-2 text-amber-400 hover:bg-amber-700/20 rounded-lg transition-colors disabled:opacity-50"
        aria-label="Cancel upload"
      >
        {isUploading ? "Uploading..." : "Cancel"}
      </button>
    </div>
  </div>
</div>
    );
  };

  const NewFolderModal = () => {
    const [newFolderName, setNewFolderName] = useState("");
    const [selectedParentFolder, setSelectedParentFolder] =
      useState(currentFolder);

    if (!showNewFolderModal) return null;

    const handleCreateFolder = () => {
      if (!newFolderName.trim()) {
        setError("Folder name is required");
        return;
      }
      createFolder(newFolderName.trim(), selectedParentFolder);
      setNewFolderName("");
      setSelectedParentFolder(currentFolder);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div className="bg-amber-700/50 rounded-2xl p-6 w-full max-w-md mx-4 text-amber-400">
    <h3 className="text-xl font-bold mb-4">Create New Folder</h3>

    <div className="mb-4">
      <label className="block text-sm font-medium text-amber-400 mb-2">
        Folder Name
      </label>
      <input
        type="text"
        value={newFolderName}
        onChange={(e) => setNewFolderName(e.target.value)}
        placeholder="Enter folder name"
        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent text-amber-400 bg-amber-700/20"
        onKeyPress={(e) => e.key === "Enter" && handleCreateFolder()}
        aria-label="Folder name"
      />
    </div>

    <div className="mb-4">
      <label className="block text-sm font-medium text-amber-400 mb-2">
        Parent Folder
      </label>
      <select
        value={selectedParentFolder}
        onChange={(e) => setSelectedParentFolder(e.target.value)}
        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent text-amber-400 bg-amber-700/20"
        aria-label="Select parent folder"
      >
        <option value="root">Root</option>
        {folders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {"  ".repeat(folder.level || 0)}
            {folder.fullPath || folder.name}
          </option>
        ))}
      </select>
    </div>

    <div className="flex justify-end space-x-3">
      <button
        onClick={() => {
          setShowNewFolderModal(false);
          setNewFolderName("");
          setSelectedParentFolder(currentFolder);
        }}
        className="px-4 py-2 text-amber-400 hover:bg-amber-700/20 rounded-lg transition-colors"
        aria-label="Cancel"
      >
        Cancel
      </button>
      <button
        onClick={handleCreateFolder}
        disabled={!newFolderName.trim() || loading}
        className="px-4 py-2 bg-amber-400 text-amber-900 rounded-lg hover:bg-amber-500 transition-colors disabled:opacity-50"
        aria-label="Create folder"
      >
        {loading ? "Creating..." : "Create Folder"}
      </button>
    </div>
  </div>
</div>
    );
  };

  const RenameModal = () => {
    const [newName, setNewName] = useState(
      renameItem
        ? renameItem.isFolder
          ? renameItem.name
          : renameItem.originalName
        : ""
    );

    if (!showRenameModal || !renameItem) return null;

    const handleRenameSubmit = () => {
      if (!newName.trim()) {
        setError("Name is required");
        return;
      }
      renameItemApi(
        renameItem.isFolder ? renameItem._id : renameItem.id,
        newName.trim(),
        renameItem.isFolder
      );
      setNewName("");
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
          <h3 className="text-xl font-bold mb-4">
            Rename {renameItem.isFolder ? "Folder" : "File"}
          </h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Enter new ${
                renameItem.isFolder ? "folder" : "file"
              } name`}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === "Enter" && handleRenameSubmit()}
              aria-label={`New ${renameItem.isFolder ? "folder" : "file"} name`}
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                setShowRenameModal(false);
                setRenameItem(null);
                setNewName("");
              }}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleRenameSubmit}
              disabled={!newName.trim() || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              aria-label="Rename"
            >
              {loading ? "Renaming..." : "Rename"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const SelectedItemsBar = () => {
    if (selectedItems.size === 0) return null;

    const selectedFileIds = Array.from(selectedItems).filter(
      (id) => !id.startsWith("folder-")
    );
    const selectedFolderIds = Array.from(selectedItems)
      .filter((id) => id.startsWith("folder-"))
      .map((id) => id.replace("folder-", ""));

    return (
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-full shadow-lg border px-6 py-3 flex items-center space-x-4 z-40">
        <span className="font-medium">{selectedItems.size} selected</span>
        <div className="flex space-x-2">
          {selectedFileIds.length > 0 && (
            <>
              <button
                onClick={() => {
                  selectedFileIds.forEach((fileId) => {
                    const file = currentFolderContents.files.find(
                      (f) => f.id === fileId
                    );
                    if (file) {
                      downloadFile(fileId, file.originalName);
                    }
                  });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Download selected files"
                aria-label="Download selected files"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete ${selectedFileIds.length} selected file(s)?`
                    )
                  ) {
                    deleteFiles(selectedFileIds);
                  }
                }}
                className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                title="Delete selected files"
                aria-label="Delete selected files"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          {selectedFolderIds.length > 0 && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    `Delete ${selectedFolderIds.length} selected folder(s)?`
                  )
                ) {
                  selectedFolderIds.forEach((folderId) =>
                    deleteFolder(folderId)
                  );
                }
              }}
              className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
              title="Delete selected folders"
              aria-label="Delete selected folders"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setSelectedItems(new Set())}
          className="text-gray-400 hover:text-gray-600 ml-2"
          aria-label="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-12">
      <Loader className="w-8 h-8 animate-spin text-amber-400" />
      <span className="ml-2 text-amber-400">Loading...</span>
    </div>
  );

  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="flex justify-center mb-4">
        {searchTerm ? (
          <File className="w-16 h-16 text-amber-400" />
        ) : (
          <Folder className="w-16 h-16 text-amber-400" />
        )}
      </div>
      <h3 className="text-xl font-medium text-amber-400 mb-2">
        {searchTerm ? "No items found" : "This folder is empty"}
      </h3>
      <p className="text-amber-400 mb-4">
        {searchTerm
          ? "Try adjusting your search terms"
          : "Upload some files or create folders to get started"}
      </p>
      {!searchTerm && (
        <div className="flex justify-center space-x-3">
          <button
            onClick={() => setShowNewFolderModal(true)}
            className="px-4 py-2 bg-amber-700/40 text-amber-400 rounded-lg hover:bg-blue-700 transition-colors"
            aria-label="Create folder"
          >
            Create Folder
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-amber-700/40 text-amber-400 rounded-lg hover:bg-amber-700/60 transition-colors"
            aria-label="Upload files"
          >
            Upload Files
          </button>
        </div>
      )}
    </div>
  );

  const Pagination = () => {
    if (!pagination.totalPages || pagination.totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    const halfVisible = Math.floor(maxVisiblePages / 2);

    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(
      pagination.totalPages,
      startPage + maxVisiblePages - 1
    );

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <nav
        className="flex items-center justify-center space-x-2 mt-6"
        aria-label="Pagination"
      >
        <button
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={!pagination.hasPrev || loading}
          className="px-3 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          aria-label="Previous page"
        >
          Previous
        </button>

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            disabled={loading}
            className={`px-3 py-2 rounded-lg border ${
              page === currentPage
                ? "bg-blue-500 text-white border-blue-500"
                : "hover:bg-gray-50"
            }`}
            aria-label={`Page ${page}`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => setCurrentPage((prev) => prev + 1)}
          disabled={!pagination.hasNext || loading}
          className="px-3 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          aria-label="Next page"
        >
          Next
        </button>

        <span className="text-sm text-gray-600 ml-4">
          {pagination.totalFiles || 0} total files
        </span>
      </nav>
    );
  };

  const hasContent = filteredFolders.length > 0 || filteredFiles.length > 0;

  return (
    <div
      className="min-h-screen bg-gradient-to-r from-amber-900/20 to-amber-800/20 backdrop-blur-sm border border-amber-700/30 rounded-lg shadow-lg p-6 m-5"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="fixed inset-0 bg-blue-500 bg-opacity-20 border-4 border-blue-500 border-dashed z-50 flex items-center justify-center">
          <div className="text-center">
            <Upload className="w-16 h-16 mx-auto mb-4 text-blue-600" />
            <p className="text-2xl font-bold text-blue-800">
              Drop files to upload
            </p>
          </div>
        </div>
      )}

      <NotificationBar />

      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className=" font-bold text-amber-100 text-2xl mb-2 text-center">
            Project&apos;s File Manager
          </h1>
          <p className="text-amber-200/80 text-center">
            Organize, upload, and manage your project files with ease
          </p>
          <p className="absolute top-4 text-amber-100">
            <strong>Project ID : </strong> {projectData?.id}
          </p>
          <p className="absolute top-10 text-amber-100">
            <strong>Project Name : </strong> {fetchProject?.name}
          </p>
        </div>

        <Breadcrumb />
        <ToolBar />

        <div className="mb-6">
          {loading ? (
            <LoadingSpinner />
          ) : !hasContent ? (
            <EmptyState />
          ) : viewMode === "grid" ? (
            <GridView />
          ) : (
            <ListView />
          )}
        </div>

        <Pagination />
      </div>

      <UploadModal />
      <NewFolderModal />
      <RenameModal />
      <SelectedItemsBar />
    </div>
  );
};

export default FileManager;
