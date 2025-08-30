import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
  Filter,
  MoreVertical,
  ArrowLeft,
  Home,
  Image,
  FileText,
  Music,
  Video,
  Archive,
  Code,
  Settings,
  Star,
  Clock,
  Users,
  Eye,
  Move,
  Copy,
  Loader,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { debounce } from "lodash";

const FileManager = ({ projectData }) => {
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

  // API integration state
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});

  // Folder state
  const [folders, setFolders] = useState({
    hierarchy: [],
    flat: [],
  });
  const [currentFolder, setCurrentFolder] = useState("root");
  const [selectedUploadFolder, setSelectedUploadFolder] = useState("root");
  const [currentFolderContents, setCurrentFolderContents] = useState({
    folders: [],
    files: [],
  });

  const fileInputRef = useRef(null);

  // Configuration
  const projectId = projectData?.id;
  const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/files`;

  // Helper functions
  const getAuthHeaders = () => ({
    Authorization: `Bearer ${
      typeof window !== "undefined"
        ? localStorage.getItem("token")
        : "mock-token"
    }`,
    "Content-Type": "application/json",
  });

  const getFileIcon = (category, name, size = "w-8 h-8") => {
    const extension = name?.split(".").pop()?.toLowerCase();

    if (category === "folder")
      return <Folder className={`${size} text-blue-500`} />;

    switch (category) {
      case ".jpg":
      case ".jpeg":
      case ".png":
      case ".gif":
      case ".svg":
      case ".webp":
        return <Image className={`${size} text-green-500`} />;
      case ".mp4":
      case ".avi":
      case ".mov":
      case ".webm":
        return <Video className={`${size} text-purple-500`} />;
      case ".mp3":
      case ".wav":
      case ".flac":
      case ".aac":
        return <Music className={`${size} text-pink-500`} />;
      case ".zip":
      case ".rar":
      case ".7z":
      case ".tar":
        return <Archive className={`${size} text-orange-500`} />;
      case ".js":
      case ".tsx":
      case ".py":
      case ".java":
      case ".cpp":
        return <Code className={`${size} text-cyan-500`} />;
      case ".pdf":
      case ".doc":
      case ".docx":
      case ".txt":
        return <FileText className={`${size} text-red-500`} />;
      default:
        return <File className={`${size} text-gray-500`} />;
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // API functions ------------>
  const fetchFolders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/folders/project/${projectId}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `Failed to fetch folders: ${response.status}`
        );
      }
      console.log("Fetching folders for projectId:", projectId);
      const data = await response.json();
      if (data.success) {
        // setFolders(data.folders || { hierarchy: [], flat: [] });
      } else {
        throw new Error(data.message || "Failed to fetch folders");
      }
    } catch (error) {
      setError(error.message);
      console.error("Fetch folders error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolderContents = async (folderId) => {
    try {
      setLoading(true);

      // Fetch subfolders with projectId------------->
      const foldersResponse = await fetch(
        `${API_BASE}/folders/${folderId}/contents?projectId=${projectId}`,
        { headers: getAuthHeaders() }
      );

      let subfolders = [];
      if (foldersResponse.ok) {
        const foldersData = await foldersResponse.json();
        console.log(
          `Folder contents for folderId: ${folderId}, projectId: ${projectId}`,
          foldersData
        );
        if (foldersData.success) {
          subfolders = foldersData.subfolders || [];
        } else {
          throw new Error(
            foldersData.message || "Failed to fetch folder contents"
          );
        }
      } else {
        throw new Error(
          `Failed to fetch folder contents: ${foldersResponse.status}`
        );
      }

      // Fetch files in current folder----->
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        ...(selectedCategory !== "all" && { category: selectedCategory }),
        ...(folderId !== "root" && { folderId }),
        ...(folderId === "root" && { folderId: "root" }),
      });

      const filesResponse = await fetch(
        `${API_BASE}/files/project/${projectId}?${queryParams}`,
        { headers: getAuthHeaders() }
      );

      let files = [];
      let pagination = {};
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        if (filesData.success) {
          files = filesData.files || [];
          pagination = filesData.pagination || {};
        } else {
          throw new Error(filesData.message || "Failed to fetch files");
        }
      } else {
        throw new Error(`Failed to fetch files: ${filesResponse.status}`);
      }

      setCurrentFolderContents({ folders: subfolders, files });
      setPagination(pagination);
    } catch (error) {
      setError(`Failed to load folder contents: ${error.message}`);
      console.error("Fetch folder contents error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      if (!projectId) {
        throw new Error("Project ID is missing");
      }
      console.log("Fetching categories for projectId:", projectId);
      const response = await fetch(
        `http://localhost:3001/files/files/project/${projectId}/categories`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`, // Adjust based on your auth method
          },
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.status}`);
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to fetch categories");
      }
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Fetch categories error:", error);
      setError(error.message);
    }
  };

  const createFolder = async (name, parentId = "root") => {
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
      if (data.success) {
        setSuccess(`Folder "${name}" created successfully`);
        setShowNewFolderModal(false);
        await fetchFolders();
        await fetchFolderContents(currentFolder);
      } else {
        throw new Error(data.message || "Failed to create folder");
      }
    } catch (error) {
      setError(error.message);
      console.error("Create folder error:", error);
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async (filesToUpload, folderPath = "root") => {
    if (!filesToUpload.length) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("description", "");
        formData.append("tags", "");
        formData.append("folder", folderPath); // Changed from folderPath to folder

        const response = await fetch(`${API_BASE}/files/upload/${projectId}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${
              typeof window !== "undefined"
                ? localStorage.getItem("token")
                : "mock-token"
            }`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to upload ${file.name}`);
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.message || `Failed to upload ${file.name}`);
        }

        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 100));
      }

      setSuccess(`Successfully uploaded ${filesToUpload.length} file(s)`);
      setShowUploadModal(false);
      fetchFolderContents(currentFolder);
      fetchCategories();
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
      const response = await fetch(`${API_BASE}/files/${fileId}/download`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to get download URL");
      }

      const data = await response.json();
      if (data.success && data.downloadUrl) {
        const link = document.createElement("a");
        link.href = data.downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      setError(`Failed to download ${fileName}: ${error.message}`);
    }
  };

  const deleteFiles = async (fileIds) => {
    try {
      setLoading(true);

      if (fileIds.length === 1) {
        const response = await fetch(`${API_BASE}/files/${fileIds[0]}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to delete file");
        }
      } else {
        const response = await fetch(`${API_BASE}/files/bulk/${projectId}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
          body: JSON.stringify({ fileIds }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to delete files");
        }
      }

      setSuccess(`Successfully deleted ${fileIds.length} file(s)`);
      setSelectedItems(new Set());
      fetchFolderContents(currentFolder);
      fetchCategories();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteFolder = async (folderId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/folders/${folderId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete folder");
      }

      setSuccess("Folder deleted successfully");
      setSelectedItems(new Set());
      await fetchFolders();
      await fetchFolderContents(currentFolder);
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
        ? `${API_BASE}/folders/${itemId}/rename`
        : `${API_BASE}/files/${itemId}/rename`;
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: newName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message ||
            `Failed to rename ${isFolder ? "folder" : "file"}`
        );
      }

      setSuccess(`Successfully renamed ${isFolder ? "folder" : "file"}`);
      setShowRenameModal(false);
      setRenameItem(null);
      await fetchFolders();
      await fetchFolderContents(currentFolder);
    } catch (error) {
      setError(error.message);
      console.error("Rename error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Event Handlers------->
  const handleFolderClick = (folder) => {
    setCurrentFolder(folder._id);
    setCurrentPath([...currentPath, { name: folder.name, id: folder._id }]);
    fetchFolderContents(folder._id);
  };

  const handleBreadcrumbClick = (index) => {
    const newPath = currentPath.slice(0, index + 1);
    setCurrentPath(newPath);
    const folderId = newPath[index].id;
    setCurrentFolder(folderId);
    fetchFolderContents(folderId);
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

  // Drag & Drop Handlers------->
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
      uploadFiles(files, currentFolder);
    }
  };

  const handleFileUpload = (files) => {
    if (files && files.length > 0) {
      uploadFiles(Array.from(files), selectedUploadFolder);
    }
  };

  // Debounced search ------>
  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearchTerm(value);
    }, 300),
    []
  );

  // Filter files and folders -------->
  const filteredFiles = useMemo(() => {
    return currentFolderContents.files.filter((file) =>
      file.originalName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [currentFolderContents.files, searchTerm]);

  const filteredFolders = useMemo(() => {
    return currentFolderContents.folders.filter((folder) =>
      folder.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [currentFolderContents.folders, searchTerm]);

  // Load initial data ------>
  useEffect(() => {
    fetchFolders();
    fetchCategories();
  }, [projectId]);

  useEffect(() => {
    fetchFolderContents(currentFolder);
  }, [currentFolder, currentPage, selectedCategory]);

  // Auto-hide messages ------>
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

  // Components ---------------->
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

  const CategoryFilter = () => (
    <div className="mb-4 flex flex-wrap gap-2">
      {categories
        .filter(
          (category) => category.name && typeof category.name === "string"
        )
        .map((category) => (
          <button
            key={category.name}
            onClick={() => {
              setSelectedCategory(category.name);
              setCurrentPage(1);
              fetchFolderContents(currentFolder);
            }}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === category.name
                ? "bg-blue-100 text-blue-800 border border-blue-300"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300"
            }`}
            aria-label={`Filter by ${category.name}`}
          >
            {category.name === "all"
              ? "All Files"
              : category.name.charAt(0).toUpperCase() +
                category.name.slice(1)}{" "}
            ({category.count || 0})
          </button>
        ))}
    </div>
  );

  const Breadcrumb = () => (
    <nav className="flex items-center space-x-2 mb-6" aria-label="Breadcrumb">
      <button
        onClick={() => handleBreadcrumbClick(0)}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
            fetchFolderContents(newPath[newPath.length - 1].id);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-100"
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
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </React.Fragment>
        ))}
      </div>
    </nav>
  );

  const ToolBar = () => (
    <div className="flex items-center justify-between mb-6 p-4 bg-white rounded-xl shadow-sm border">
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setShowNewFolderModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all transform hover:scale-105"
          aria-label="Create new folder"
        >
          <FolderPlus className="w-4 h-4" />
          <span>New Folder</span>
        </button>

        <button
          onClick={() => setShowUploadModal(true)}
          disabled={isUploading}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 disabled:opacity-50"
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
            fetchFolderContents(currentFolder);
            fetchCategories();
          }}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all transform hover:scale-105 disabled:opacity-50"
          aria-label="Refresh content"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>

        <div className="h-6 w-px bg-gray-300 mx-2" />

        <div
          className="flex items-center bg-gray-100 rounded-lg p-1"
          role="group"
          aria-label="View mode"
        >
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded ${
              viewMode === "grid" ? "bg-white shadow-sm" : ""
            }`}
            aria-label="Grid view"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded ${
              viewMode === "list" ? "bg-white shadow-sm" : ""
            }`}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search files and folders..."
            onChange={(e) => debouncedSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        item,
        isFolder,
      });
    };

    const closeContextMenu = () => setContextMenu(null);

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Render Folders */}
        {filteredFolders.map((folder) => (
          <div
            key={`folder-${folder._id}`}
            className={`group relative p-4 rounded-xl border-2 border-dashed border-transparent hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer transform hover:scale-105 ${
              selectedItems.has(`folder-${folder._id}`)
                ? "bg-blue-100 border-blue-400"
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
              <div className="p-3 bg-blue-100 rounded-full">
                <FolderOpen className="w-8 h-8 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-900 truncate w-full">
                  {folder.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDate(folder.createdAt)}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Render Files */}
        {filteredFiles.map((file) => (
          <div
            key={`file-${file.id}`}
            className={`group relative p-4 rounded-xl border-2 border-dashed border-transparent hover:border-green-300 hover:bg-green-50 transition-all cursor-pointer transform hover:scale-105 ${
              selectedItems.has(file.id)
                ? "bg-green-100 border-green-400"
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
              <div className="p-3 bg-gray-100 rounded-full">
                {getFileIcon(file.category, file.originalName)}
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-900 truncate w-full">
                  {file.originalName}
                </p>
                <p className="text-xs text-gray-500">
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
    );
  };

  const ListView = () => {
    const [contextMenu, setContextMenu] = useState(null);

    const handleContextMenu = (e, item, isFolder) => {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        item,
        isFolder,
      });
    };

    const closeContextMenu = () => setContextMenu(null);

    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 font-medium text-gray-700">
          <div className="col-span-5">Name</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-2">Modified</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-1">Actions</div>
        </div>

        {/* Render Folders */}
        {filteredFolders.map((folder) => (
          <div
            key={`folder-${folder._id}`}
            className={`grid grid-cols-12 gap-4 p-4 border-b hover:bg-gray-50 cursor-pointer transition-colors ${
              selectedItems.has(`folder-${folder._id}`) ? "bg-blue-50" : ""
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
              />
              <FolderOpen className="w-6 h-6 text-blue-500" />
              <span className="font-medium">{folder.name}</span>
            </div>
            <div className="col-span-2 text-gray-600">—</div>
            <div className="col-span-2 text-gray-600">
              {formatDate(folder.createdAt)}
            </div>
            <div className="col-span-2 text-gray-600">Folder</div>
            <div className="col-span-1">
              <button
                className="p-1 hover:bg-gray-200 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  handleContextMenu(e, folder, true);
                }}
                aria-label="Folder actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Render Files */}
        {filteredFiles.map((file) => (
          <div
            key={`file-${file.id}`}
            className={`grid grid-cols-12 gap-4 p-4 border-b hover:bg-gray-50 transition-colors ${
              selectedItems.has(file.id) ? "bg-green-50" : ""
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
                aria-label={`Select file ${file.originalName}`}
              />
              {getFileIcon(file.category, file.originalName, "w-6 h-6")}
              <span className="font-medium">{file.originalName}</span>
            </div>
            <div className="col-span-2 text-gray-600">
              {formatFileSize(file.fileSize)}
            </div>
            <div className="col-span-2 text-gray-600">
              {formatDate(file.uploadedAt)}
            </div>
            <div className="col-span-2 text-gray-600 capitalize">
              {file.category}
            </div>
            <div className="col-span-1">
              <button
                className="p-1 hover:bg-gray-200 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  handleContextMenu(e, file, false);
                }}
                aria-label="File actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
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
    );
  };

  const UploadModal = () => {
    if (!showUploadModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
          <h3 className="text-xl font-bold mb-4">Upload Files</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Destination Folder
            </label>
            <select
              value={selectedUploadFolder}
              onChange={(e) => setSelectedUploadFolder(e.target.value)}
              disabled={isUploading}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Select destination folder"
            >
              <option value="root">Root</option>
              {folders.flat.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {"  ".repeat(folder.level)}
                  {folder.fullPath}
                </option>
              ))}
            </select>
          </div>

          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
            onClick={() => !isUploading && fileInputRef.current?.click()}
            role="button"
            aria-label="Upload files"
          >
            {isUploading ? (
              <div>
                <Loader className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
                <p className="text-gray-600 mb-2">Uploading files...</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {uploadProgress}% complete
                </p>
              </div>
            ) : (
              <div>
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-2">
                  Drag and drop files here, or click to select
                </p>
                <p className="text-sm text-gray-400">Supports all file types</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
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
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
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
        <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
          <h3 className="text-xl font-bold mb-4">Create New Folder</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Folder Name
            </label>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Enter folder name"
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === "Enter" && handleCreateFolder()}
              aria-label="Folder name"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Parent Folder
            </label>
            <select
              value={selectedParentFolder}
              onChange={(e) => setSelectedParentFolder(e.target.value)}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Select parent folder"
            >
              <option value="root">Root</option>
              {folders.flat.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {"  ".repeat(folder.level)}
                  {folder.fullPath}
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
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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
          ×
        </button>
      </div>
    );
  };

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-12">
      <Loader className="w-8 h-8 animate-spin text-blue-500" />
      <span className="ml-2 text-gray-600">Loading...</span>
    </div>
  );

  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="flex justify-center mb-4">
        {currentFolder === "root" ? (
          <Folder className="w-16 h-16 text-gray-300" />
        ) : (
          <File className="w-16 h-16 text-gray-300" />
        )}
      </div>
      <h3 className="text-xl font-medium text-gray-900 mb-2">
        {searchTerm ? "No items found" : "This folder is empty"}
      </h3>
      <p className="text-gray-500 mb-4">
        {searchTerm
          ? "Try adjusting your search terms"
          : "Upload some files or create folders to get started"}
      </p>
      {!searchTerm && (
        <div className="flex justify-center space-x-3">
          <button
            onClick={() => setShowNewFolderModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            aria-label="Create folder"
          >
            Create Folder
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
          onClick={() => setCurrentPage(currentPage - 1)}
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
          onClick={() => setCurrentPage(currentPage + 1)}
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
      className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6"
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Project File Manager
          </h1>
          <p className="text-gray-600">
            Organize, upload, and manage your project files with ease
          </p>
          <p>Project ID:{projectData?.id}</p>
        </div>

        <CategoryFilter />
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
