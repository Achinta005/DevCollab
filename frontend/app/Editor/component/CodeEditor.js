import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
import { useFileManager } from "../../context/FileManagerContext";
import { Code } from "lucide-react";
import * as Y from "yjs";

// Import sub-components
import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import OutputPanel from "./components/OutputPanel";
import NewFileModal from "./components/NewFileModel";
import CollaborationPanel from "./components/CollaborationPanel";
import { projectService } from "../../../services";
import CommunicationComponent from "./Communiaction";

// Import utilities and constants
import { JUDGE0_LANGUAGES } from "./components/constants";
import {
  canExecuteFile,
  getJudge0LanguageId,
  getLanguageFromFileType,
  buildFileTree,
  getTemplateContent,
} from "./components/utils";

// Dynamically import collaboration utilities to avoid SSR issues
const CollaborationUtils = dynamic(
  () => import("./components/cursor-tracking"),
  { ssr: false }
);

// Dynamically import WebsocketProvider to avoid SSR issues
const WebsocketProvider = dynamic(
  () =>
    import("y-websocket").then((mod) => ({ default: mod.WebsocketProvider })),
  { ssr: false }
);

function CodeEditor({ userId, userName }) {
  const {
    allFiles,
    folders: flatFolders,
    getAuthHeaders,
    fetchAllFiles,
    fetchFolders,
    projectId,
  } = useFileManager();

  const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/editor`;
  const WS_BASE = `${process.env.NEXT_PUBLIC_SOCKET_URL}`;

  // Refs for editor and collaboration
  const editorRef = useRef(null);
  const monacoBindingRef = useRef(null);
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const ytextRef = useRef(null);
  const awarenessManagerRef = useRef(null);
  const collaborationUtilsRef = useRef(null);

  // File state
  const [selectedFile, setSelectedFile] = useState(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorLanguage, setEditorLanguage] = useState("plaintext");
  const [isPdf, setIsPdf] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [localFiles, setLocalFiles] = useState(new Map());
  const [project, setProject] = useState(null);

  // UI state
  const [errorMessage, setErrorMessage] = useState("");
  const [showFileMenu, setShowFileMenu] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Modal state
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileType, setNewFileType] = useState("js");
  const [newFileFolder, setNewFileFolder] = useState("root");

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOutput, setExecutionOutput] = useState("");
  const [executionError, setExecutionError] = useState("");
  const [showOutput, setShowOutput] = useState(false);
  const [executionInput, setExecutionInput] = useState("");
  const [isOutputMaximized, setIsOutputMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState("output");

  // Enhanced collaboration state
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [isCollaborationEnabled, setIsCollaborationEnabled] = useState(false);
  const [collaborationStatus, setCollaborationStatus] =
    useState("disconnected");
  const [lastSaved, setLastSaved] = useState(null);
  const [documentSynced, setDocumentSynced] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const data = await projectService.getProject(projectId); // ✅ wait for promise
        setProject(data.data); // now it's the actual object, not a Promise
      } catch (error) {
        console.error("Failed to fetch project:", error);
      }
    };

    fetchProject();
  }, [projectId]);

  // Check if we're on client side
  useEffect(() => {
    setIsClient(true);
  }, [project]);

  const currentUserId = userId; // e.g. from auth context or localStorage

  // Find collaborator entry for current user
  const collaborator = project?.collaborators?.find(
    (c) => c.user._id === currentUserId
  );

  const currentUserRole = collaborator?.role;
  const canEdit = currentUserRole === "owner" || currentUserRole === "editor";

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // Build file tree
  const tree = useMemo(
    () => buildFileTree(flatFolders, allFiles, localFiles),
    [flatFolders, allFiles, localFiles]
  );

  // Load collaboration utilities
  useEffect(() => {
    if (isClient) {
      import("./components/cursor-tracking").then((module) => {
        collaborationUtilsRef.current = module;
      });
    }
  }, [isClient]);

  // Enhanced collaboration initialization
  const initializeCollaboration = async (fileId) => {
    if (!isClient || !collaborationUtilsRef.current) return null;

    try {
      cleanupCollaboration();

      const ydoc = new Y.Doc();
      const ytext = ydoc.getText("monaco");

      // Dynamically import WebsocketProvider
      const { WebsocketProvider } = await import("y-websocket");

      const roomId = `file_${fileId}_${projectId}`;
      const provider = new WebsocketProvider(WS_BASE, roomId, ydoc, {
        params: {
          userId,
          userName,
          token,
          fileId,
          projectId,
        },
      });

      // Enhanced connection handling
      provider.on("status", (event) => {
        setCollaborationStatus(event.status);
        console.log("Collaboration status:", event.status);

        if (event.status === "connected") {
          setErrorMessage("✅ Real-time collaboration enabled!");
          setTimeout(() => setErrorMessage(""), 3000);
        } else if (event.status === "disconnected") {
          setErrorMessage("⚠️ Real-time collaboration disconnected");
        }
      });

      // Enhanced sync handling
      provider.on("sync", (isSynced) => {
        setDocumentSynced(isSynced);

        if (isSynced) {
          // Load initial content if document is empty
          if (ytext.toString() === "" && editorContent) {
            ytext.insert(0, editorContent);
          }
          console.log("Document synchronized");
        }
      });

      // Enhanced user awareness
      const { AwarenessManager, formatUserActivity } =
        collaborationUtilsRef.current;
      const awarenessManager = new AwarenessManager(provider, userId, userName);
      awarenessManagerRef.current = awarenessManager;

      // Track connected users with enhanced information
      provider.awareness.on("update", () => {
        const users = Array.from(provider.awareness.getStates().entries())
          .map(([clientId, state]) => ({
            clientId,
            userId: state.userId,
            userName: state.userName,
            color: state.color,
            cursor: state.cursor,
            selection: state.selection,
            typing: state.typing,
            joinedAt: state.joinedAt,
            lastActivity: state.lastActivity,
            activities: formatUserActivity(state),
          }))
          .filter((user) => user.userId && user.userId !== userId)
          .sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));

        setConnectedUsers(users);
      });

      // Store references
      ydocRef.current = ydoc;
      providerRef.current = provider;
      ytextRef.current = ytext;

      setIsCollaborationEnabled(true);
      return { ydoc, ytext, provider };
    } catch (error) {
      console.error("Failed to initialize collaboration:", error);
      setErrorMessage(`❌ Collaboration error: ${error.message}`);
      return null;
    }
  };

  // Enhanced cleanup
  const cleanupCollaboration = () => {
    if (awarenessManagerRef.current) {
      awarenessManagerRef.current.destroy();
      awarenessManagerRef.current = null;
    }

    if (monacoBindingRef.current) {
      monacoBindingRef.current.destroy();
      monacoBindingRef.current = null;
    }

    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }

    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }

    ytextRef.current = null;
    setIsCollaborationEnabled(false);
    setCollaborationStatus("disconnected");
    setConnectedUsers([]);
    setDocumentSynced(false);
  };

  // Enhanced Monaco editor mount handler
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    if (
      ytextRef.current &&
      providerRef.current &&
      awarenessManagerRef.current &&
      collaborationUtilsRef.current
    ) {
      setupMonacoBinding(editor, monaco);
    }
  };

  // Enhanced Monaco binding setup
  const setupMonacoBinding = (editor, monaco) => {
    if (
      !ytextRef.current ||
      !providerRef.current ||
      !awarenessManagerRef.current ||
      !collaborationUtilsRef.current
    )
      return;

    if (typeof window === "undefined") {
      console.warn("Monaco binding setup skipped during SSR");
      return;
    }

    try {
      // Use enhanced Monaco binding with cursor tracking
      const { setupEnhancedMonacoBinding } = collaborationUtilsRef.current;
      const binding = setupEnhancedMonacoBinding(
        ytextRef.current,
        editor,
        providerRef.current
      );

      monacoBindingRef.current = binding;

      // Enhanced cursor and selection tracking
      const updateAwareness = () => {
        const selection = editor.getSelection();
        const position = editor.getPosition();

        if (position) {
          awarenessManagerRef.current.setCursor(
            position.lineNumber,
            position.column
          );
        }

        if (selection && !selection.isEmpty()) {
          const selectedText = editor.getModel().getValueInRange(selection);
          awarenessManagerRef.current.setSelection(
            selection.startLineNumber,
            selection.startColumn,
            selection.endLineNumber,
            selection.endColumn,
            selectedText
          );
        } else {
          awarenessManagerRef.current.clearSelection();
        }
      };

      // Track editor events
      editor.onDidChangeCursorPosition(updateAwareness);
      editor.onDidChangeCursorSelection(updateAwareness);

      let typingTimeout;
      editor.onDidChangeModelContent(() => {
        awarenessManagerRef.current.setTyping(true);

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          awarenessManagerRef.current.setTyping(false);
        }, 2000);
      });

      console.log("Enhanced Monaco binding established");
    } catch (error) {
      console.error("Failed to setup enhanced Monaco binding:", error);
      setErrorMessage(`❌ Collaboration setup error: ${error.message}`);
    }
  };

  // Use cursor decorations hook - only on client
  useEffect(() => {
    if (isClient && collaborationUtilsRef.current && editorRef.current) {
      const { useCursorDecorations } = collaborationUtilsRef.current;
      // Note: This might need to be refactored depending on how your hook is implemented
    }
  }, [isClient, connectedUsers]);

  // Load file content with collaboration
  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile.id);
    } else {
      setEditorContent("");
      setEditorLanguage("plaintext");
      setIsPdf(false);
      setDownloadUrl("");
      setErrorMessage("");
      setShowOutput(false);
      cleanupCollaboration();
    }
  }, [selectedFile]);

  // Initialize collaboration for server files
  useEffect(() => {
    if (
      selectedFile &&
      !isPdf &&
      !localFiles.has(selectedFile.id) &&
      isClient
    ) {
      const initCollaboration = async () => {
        const collaboration = await initializeCollaboration(selectedFile.id);

        if (collaboration && editorRef.current && window.monaco) {
          setupMonacoBinding(editorRef.current, window.monaco);
        }
      };

      initCollaboration();
    }

    return () => {
      if (!selectedFile) {
        cleanupCollaboration();
      }
    };
  }, [selectedFile, isPdf, editorContent, isClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupCollaboration();
    };
  }, []);

  // Close file menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowFileMenu(null);
    if (isClient) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isClient]);

  // File loading with collaboration awareness
  const loadFileContent = async (fileId) => {
    try {
      setErrorMessage("");
      cleanupCollaboration();

      if (localFiles.has(fileId)) {
        const localFile = localFiles.get(fileId);
        setEditorContent(localFile.content || "");
        setEditorLanguage(getLanguageFromFileType(localFile.fileType));
        setIsPdf(false);
        setDownloadUrl("");
        return;
      }

      const fileType = selectedFile.originalName.split(".").pop().toLowerCase();
      const supportedTypes = JUDGE0_LANGUAGES.map(
        (lang) => lang.extension
      ).concat(["html", "css", "json", "xml", "md", "yaml", "yml"]);

      if (fileType === "pdf") {
        setIsPdf(true);
        const response = await fetch(`${API_BASE}/${fileId}/download`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok)
          throw new Error(
            `Failed to fetch download URL: ${response.statusText}`
          );
        const data = await response.json();
        if (!data.success)
          throw new Error(data.message || "Failed to fetch download URL");
        setDownloadUrl(data.downloadUrl);
        setEditorContent("");
        return;
      }

      if (!supportedTypes.includes(fileType)) {
        setErrorMessage(
          `File type (.${fileType}) is not supported in the code editor.`
        );
        setEditorContent("");
        setIsPdf(false);
        setDownloadUrl("");
        return;
      }

      setIsPdf(false);
      setDownloadUrl("");
      const response = await fetch(`${API_BASE}/${fileId}/content`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok)
        throw new Error(`Failed to fetch file content: ${response.statusText}`);
      const data = await response.json();
      if (!data.success)
        throw new Error(data.message || "Failed to fetch file content");

      setEditorContent(data.content || "");
      setEditorLanguage(getLanguageFromFileType(fileType));
    } catch (error) {
      setErrorMessage(
        `❌ Error: ${error.message}. Please check if the file exists or you have access.`
      );
      setEditorContent("");
      setIsPdf(false);
      setDownloadUrl("");
    }
  };

  // Rest of the methods remain the same but with enhanced error messages and collaboration awareness
  const getUploadHeaders = () => {
    const headers = getAuthHeaders();
    delete headers["Content-Type"];
    return headers;
  };

  const handleSaveFile = async () => {
    if (!selectedFile || isPdf || isSaving) return;

    const isLocalFile = localFiles.has(selectedFile.id);
    let contentToSave = editorContent;

    // Get content from Yjs document if collaboration is active
    if (ytextRef.current && !isLocalFile && documentSynced) {
      contentToSave = ytextRef.current.toString();
    }

    if (isLocalFile) {
      if (!window.confirm("Save this new file to the server?")) return;
    } else {
      if (
        !window.confirm("Are you sure you want to save changes to this file?")
      )
        return;
    }

    setIsSaving(true);
    try {
      setErrorMessage("");

      if (isLocalFile) {
        // Create file on server
        const localFile = localFiles.get(selectedFile.id);
        const formData = new FormData();
        formData.append("originalName", localFile.originalName);
        formData.append("folder", localFile.folder);

        const contentBlob = new Blob([contentToSave], { type: "text/plain" });
        formData.append("file", contentBlob, localFile.originalName);

        const response = await fetch(`${API_BASE}/upload/${projectId}`, {
          method: "POST",
          headers: getUploadHeaders(),
          body: formData,
        });

        if (!response.ok)
          throw new Error(`Failed to save file: ${response.statusText}`);
        const data = await response.json();
        if (!data.success)
          throw new Error(data.message || "Failed to save file");

        setLocalFiles((prev) => {
          const newMap = new Map(prev);
          newMap.delete(selectedFile.id);
          return newMap;
        });

        await fetchAllFiles();
        setSelectedFile(null);
        setErrorMessage("✅ File saved to server successfully!");
      } else {
        // Update existing file
        const response = await fetch(
          `${API_BASE}/${selectedFile.id}/content/submit`,
          {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ content: contentToSave }),
          }
        );

        if (!response.ok)
          throw new Error(`Failed to save file: ${response.statusText}`);
        const data = await response.json();
        if (!data.success)
          throw new Error(data.message || "Failed to save file");

        setLastSaved(Date.now());
        setErrorMessage("✅ File saved successfully!");
      }

      setTimeout(() => setErrorMessage(""), 3000);
    } catch (error) {
      setErrorMessage(`❌ Error saving file: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFile = async (file, event) => {
    event.stopPropagation();
    setShowFileMenu(null);

    const isLocalFile = localFiles.has(file.id);

    if (isLocalFile) {
      if (
        !window.confirm(
          `Are you sure you want to delete "${file.originalName}"? This action cannot be undone.`
        )
      )
        return;

      setLocalFiles((prev) => {
        const newMap = new Map(prev);
        newMap.delete(file.id);
        return newMap;
      });

      if (selectedFile?.id === file.id) {
        setSelectedFile(null);
      }

      setErrorMessage("✅ Local file deleted successfully!");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete "${file.originalName}" from the server? This action cannot be undone.`
      )
    )
      return;

    setIsDeleting(true);
    try {
      setErrorMessage("");

      const response = await fetch(`${API_BASE}/${file.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to delete file: ${response.statusText}`
        );
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to delete file");
      }

      if (selectedFile?.id === file.id) {
        setSelectedFile(null);
      }

      await fetchAllFiles();
      setErrorMessage("✅ File deleted successfully!");
      setTimeout(() => setErrorMessage(""), 3000);
    } catch (error) {
      setErrorMessage(`❌ Error deleting file: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchAllFiles();
      await fetchFolders();
      setErrorMessage("✅ Files refreshed successfully!");
      setTimeout(() => setErrorMessage(""), 3000);
    } catch (error) {
      setErrorMessage(`❌ Error refreshing files: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateFile = () => {
    if (!projectId) {
      setErrorMessage(
        "❌ Error: Project ID is missing. Please ensure you are in a valid project context."
      );
      return;
    }
    if (!newFileName) {
      setErrorMessage("Please enter a file name");
      return;
    }

    try {
      setErrorMessage("");

      const localFileId = `local_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const fileName = `${newFileName}.${newFileType}`;

      const getTemplateContent = (fileType) => {
        const templates = {
          c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
          cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',
          java: `public class ${newFileName} {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
          py: 'print("Hello, World!")',
          js: 'console.log("Hello, World!");',
          ts: 'console.log("Hello, World!");',
          html: "<!DOCTYPE html>\n<html>\n<head>\n    <title>Hello World</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>",
          css: "/* Hello World CSS */\nbody {\n    font-family: Arial, sans-serif;\n}",
          json: '{\n  "message": "Hello, World!"\n}',
          md: "# Hello World\n\nThis is a markdown file.",
          txt: "Hello, World!",
        };
        return templates[fileType] || `// New ${fileType} file: ${fileName}\n`;
      };

      const localFile = {
        id: localFileId,
        originalName: fileName,
        folder: newFileFolder,
        fileType: newFileType,
        content: getTemplateContent(newFileType),
        isLocal: true,
      };

      setLocalFiles((prev) => new Map(prev).set(localFileId, localFile));
      setSelectedFile(localFile);

      setIsNewFileModalOpen(false);
      setNewFileName("");
      setNewFileType("js");
      setNewFileFolder("root");
      setErrorMessage(
        "✅ File created locally! Edit and save to upload to server."
      );
      setTimeout(() => setErrorMessage(""), 3000);
    } catch (error) {
      setErrorMessage(`❌ Error creating file: ${error.message}`);
    }
  };

  const handleExecuteFile = async () => {
    if (
      !selectedFile ||
      !canExecuteFile(selectedFile.originalName) ||
      isExecuting
    )
      return;

    const languageId = getJudge0LanguageId(selectedFile.originalName);
    if (!languageId) {
      setExecutionError("Language not supported for execution");
      setShowOutput(true);
      return;
    }

    setIsExecuting(true);
    setExecutionOutput("");
    setExecutionError("");
    setShowOutput(true);

    try {
      // Get current content from Yjs if collaboration is active
      let fileContent = editorContent;
      if (
        ytextRef.current &&
        !localFiles.has(selectedFile.id) &&
        documentSynced
      ) {
        fileContent = ytextRef.current.toString();
      }

      const response = await fetch(`${API_BASE}/execute`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fileName: selectedFile.originalName,
          content: fileContent,
          input: executionInput,
          projectId: projectId,
          languageId: languageId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Execution failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        setExecutionError(data.error || "Execution failed");
        setExecutionOutput(data.output || "");
      } else {
        setExecutionOutput(
          data.output || "Program executed successfully (no output)"
        );
        setExecutionError(data.error || "");
      }
    } catch (error) {
      setExecutionError(`Error: ${error.message}`);
      setExecutionOutput("");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleEditorChange = (value) => {
    setEditorContent(value);

    // Update local files if it's a local file
    if (selectedFile && localFiles.has(selectedFile.id)) {
      setLocalFiles((prev) => {
        const newMap = new Map(prev);
        const localFile = newMap.get(selectedFile.id);
        newMap.set(selectedFile.id, { ...localFile, content: value });
        return newMap;
      });
    }
  };

  const editorOptions = {
    minimap: { enabled: true },
    fontSize: 14,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: "on",
    lineNumbers: "on",
    folding: true,
    showFoldingControls: "always",
    bracketMatching: "always",
    autoIndent: "full",
    formatOnType: true,
    formatOnPaste: true,
    suggestions: { enabled: true },
    quickSuggestions: { other: true, comments: false, strings: false },
    parameterHints: { enabled: true },
    hover: { enabled: true },
    codeLens: true,
    colorDecorators: true,
    lightbulb: { enabled: true },
    occurrencesHighlight: true,
    selectionHighlight: true,
    snippetSuggestions: "inline",
    // Enhanced for collaboration
    glyphMargin: true, // For user cursors
    renderLineHighlight: "gutter", // Better visibility with multiple cursors
    readOnly: !canEdit,
  };

  // Don't render until client-side
  if (!isClient) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 mx-5 rounded-lg items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4" />
          <span className="text-slate-400">Loading Editor...</span>
        </div>
      </div>
    );
  }

  //Defining Project Data for Communication components
  const projectData = {
    projectId: project?.id,
    userId: userId,
    userName: userName,
    token: token,
    wsUrl: "ws://localhost:1234",
  };

  return (
    <>
      <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 mx-5 rounded-lg">
        {/* Sidebar */}
        <Sidebar
          tree={tree}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          showFileMenu={showFileMenu}
          setShowFileMenu={setShowFileMenu}
          onRefresh={handleRefresh}
          onNewFile={() => setIsNewFileModalOpen(true)}
          onDeleteFile={handleDeleteFile}
          isRefreshing={isRefreshing}
          isDeleting={isDeleting}
          projectId={projectId}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Enhanced Toolbar with Collaboration */}
          <Toolbar
            selectedFile={selectedFile}
            isPdf={isPdf}
            isSaving={isSaving}
            isExecuting={isExecuting}
            onSave={handleSaveFile}
            onExecute={handleExecuteFile}
            isCollaborationEnabled={isCollaborationEnabled}
            collaborationStatus={collaborationStatus}
            connectedUsersCount={connectedUsers.length}
            lastSaved={lastSaved}
          />

          {/* Editor Area */}
          <div
            className={`flex-1 ${
              showOutput && !isOutputMaximized ? "h-1/2" : ""
            }`}
          >
            {/* Enhanced Status/Error Bar */}
            {errorMessage && (
              <div
                className={`mx-4 mt-3 p-3 rounded-lg ${
                  errorMessage.includes("✅")
                    ? "bg-green-600/20 text-green-300 border border-green-600/30"
                    : errorMessage.includes("⚠️")
                    ? "bg-yellow-600/20 text-yellow-300 border border-yellow-600/30"
                    : "bg-red-600/20 text-red-300 border border-red-600/30"
                }`}
              >
                <div className="flex items-center">
                  <div
                    className={`w-2 h-2 rounded-full mr-2 ${
                      errorMessage.includes("✅")
                        ? "bg-green-400"
                        : errorMessage.includes("⚠️")
                        ? "bg-yellow-400"
                        : "bg-red-400"
                    }`}
                  />
                  {errorMessage}
                </div>
              </div>
            )}

            <div className="flex flex-1">
              {/* Editor */}
              <div className="flex-1">
                {selectedFile ? (
                  isPdf ? (
                    <div className="p-4">
                      <div className="text-slate-400 mb-4">
                        PDF files cannot be edited in the code editor.
                      </div>
                      {downloadUrl ? (
                        <iframe
                          src={downloadUrl}
                          className="w-full h-[calc(100vh-200px)] border border-slate-600/50 rounded-lg bg-white"
                          title="PDF Viewer"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-64">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mr-3" />
                          <span className="text-slate-400">Loading PDF...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full relative">
                      {/* Collaboration status overlay */}
                      {isCollaborationEnabled && !documentSynced && (
                        <div className="absolute top-4 right-4 z-10 bg-yellow-600/90 text-yellow-100 px-3 py-1 rounded-md text-sm flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-3 w-3 border border-yellow-300 border-t-transparent" />
                          <span>Syncing document...</span>
                        </div>
                      )}

                      <Editor
                        height={
                          showOutput && !isOutputMaximized
                            ? "calc(50vh - 120px)"
                            : "calc(100vh - 140px)"
                        }
                        language={editorLanguage}
                        value={
                          localFiles.has(selectedFile.id)
                            ? editorContent
                            : undefined
                        }
                        onChange={
                          canEdit && localFiles.has(selectedFile.id)
                            ? handleEditorChange
                            : undefined
                        }
                        onMount={handleEditorDidMount}
                        options={editorOptions}
                        theme="vs-dark"
                      />
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Code className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                      <h3 className="text-slate-300 text-xl mb-2">
                        Welcome to DevCollab
                      </h3>
                      <p className="text-slate-400 mb-6 max-w-md">
                        Select a file from the sidebar to start editing
                        collaboratively in real-time.
                      </p>
                      <div className="flex items-center justify-center space-x-6 text-sm text-slate-500">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          <span>Real-time sync</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-blue-400" />
                          <span>Live cursors</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-purple-400" />
                          <span>Multi-user editing</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Enhanced Collaboration Panel */}
              {isCollaborationEnabled && selectedFile && !isPdf && (
                <CollaborationPanel
                  connectedUsers={connectedUsers}
                  collaborationStatus={collaborationStatus}
                  currentUser={{ userId, userName }}
                  documentSynced={documentSynced}
                  roomId={`file_${selectedFile.id}_${projectId}`}
                />
              )}
            </div>
          </div>

          {/* Output Panel */}
          {showOutput && (
            <OutputPanel
              isOutputMaximized={isOutputMaximized}
              setIsOutputMaximized={setIsOutputMaximized}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              selectedFile={selectedFile}
              executionInput={executionInput}
              setExecutionInput={setExecutionInput}
              isExecuting={isExecuting}
              executionOutput={executionOutput}
              executionError={executionError}
              onClose={() => setShowOutput(false)}
            />
          )}
        </div>

        {/* New File Modal */}
        {isNewFileModalOpen && (
          <NewFileModal
            isOpen={isNewFileModalOpen}
            onClose={() => setIsNewFileModalOpen(false)}
            newFileName={newFileName}
            setNewFileName={setNewFileName}
            newFileType={newFileType}
            setNewFileType={setNewFileType}
            newFileFolder={newFileFolder}
            setNewFileFolder={setNewFileFolder}
            flatFolders={flatFolders}
            onCreate={handleCreateFile}
          />
        )}
      </div>
      <CommunicationComponent
        projectId={projectId}
        userId={projectData.userId}
        userName={projectData.userName}
        token={projectData.token}
        wsUrl={projectData.wsUrl}
      />
    </>
  );
}

export default CodeEditor;
