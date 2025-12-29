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

  const initialContentRef = useRef(null);
  const isCollaborationInitializedRef = useRef(false);
  const [contentLoaded, setContentLoaded] = useState(false);

  const previousFileIdRef = useRef(null);

  useEffect(() => {
    if (previousFileIdRef.current !== selectedFile?.id) {
      cleanupCollaboration();
      isCollaborationInitializedRef.current = false;
      previousFileIdRef.current = selectedFile?.id;
    }
  }, [selectedFile?.id]);

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
  const isOwner = project?.owner?.id === currentUserId;

  const collaborator = project?.collaborators?.find(
    (c) => c.userId === currentUserId
  );

  const isEditor = collaborator?.role === "editor";

  const canEdit = isOwner || isEditor;

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

  // Enhanced cleanup
  const cleanupCollaboration = () => {
    if (awarenessManagerRef.current) {
      try {
        awarenessManagerRef.current.destroy();
      } catch (e) {
        console.error(" Error destroying awareness:");
      }
      awarenessManagerRef.current = null;
    }

    if (monacoBindingRef.current) {
      try {
        monacoBindingRef.current.destroy();
      } catch (e) {
        console.error(" Error destroying binding:");
      }
      monacoBindingRef.current = null;
    }

    if (providerRef.current) {
      try {
        providerRef.current.destroy();
      } catch (e) {
        console.error(" Error destroying provider:");
      }
      providerRef.current = null;
    }

    if (ydocRef.current) {
      try {
        ydocRef.current.destroy();
      } catch (e) {
        console.error("Error destroying ydoc:");
      }
      ydocRef.current = null;
    }

    ytextRef.current = null;
    isCollaborationInitializedRef.current = false;
    setContentLoaded(false); // ✅ Reset state instead of ref
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

  // Use cursor decorations hook - only on client
  useEffect(() => {
    if (isClient && collaborationUtilsRef.current && editorRef.current) {
      const { useCursorDecorations } = collaborationUtilsRef.current;
    }
  }, [isClient, connectedUsers]);

  // (1) Load file content with collaboration
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

  // (2) File loading with collaboration awareness
  const loadFileContent = async (fileId) => {
    try {
      setErrorMessage("");
      setContentLoaded(false);
      initialContentRef.current = null;

      if (localFiles.has(fileId)) {
        const localFile = localFiles.get(fileId);
        const content = localFile.content || "";

        setEditorContent(content);
        setEditorLanguage(getLanguageFromFileType(localFile.fileType));
        setIsPdf(false);
        setDownloadUrl("");
        setContentLoaded(true);
        initialContentRef.current = content;
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
        setContentLoaded(true);
        return;
      }

      if (!supportedTypes.includes(fileType)) {
        setErrorMessage(
          `File type (.${fileType}) is not supported in the code editor.`
        );
        setEditorContent("");
        setIsPdf(false);
        setDownloadUrl("");
        setContentLoaded(true);
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

      const content = data.content || "";

      // Set content FIRST
      setEditorContent(content);
      setEditorLanguage(getLanguageFromFileType(fileType));
      initialContentRef.current = content;

      setContentLoaded(true);
    } catch (error) {
      setErrorMessage(
        `❌ Error: ${error.message}. Please check if the file exists or you have access.`
      );
      setEditorContent("");
      setIsPdf(false);
      setDownloadUrl("");
      setContentLoaded(true);
    }
  };

  // (3) Initialize collaboration for server files
  useEffect(() => {
    // Check all conditions
    if (
      selectedFile &&
      !isPdf &&
      !localFiles.has(selectedFile.id) &&
      isClient &&
      contentLoaded &&
      !isCollaborationInitializedRef.current
    ) {
      const initCollaboration = async () => {
        try {
          const collaboration = await initializeCollaboration(selectedFile.id);

          if (
            collaboration &&
            editorRef.current &&
            typeof window !== "undefined" &&
            window.monaco
          ) {
            setupMonacoBinding(editorRef.current, window.monaco);
          } else {
            console.warn("⚠️ [COLLAB USEEFFECT] Cannot setup binding:", {
              hasCollaboration: !!collaboration,
              hasEditor: !!editorRef.current,
              hasMonaco: !!(typeof window !== "undefined" && window.monaco),
            });
          }

          isCollaborationInitializedRef.current = true;
        } catch (error) {
          console.error("❌ [COLLAB USEEFFECT] Error during initialization:", {
            error: error.message,
            stack: error.stack,
          });
        }
      };

      initCollaboration();
    } else {
    }

    return () => {
      // Only reset flag when file changes
      if (selectedFile) {
        isCollaborationInitializedRef.current = false;
      }
    };
  }, [selectedFile, isPdf, isClient, contentLoaded]);

  //(4) Enhanced collaboration initialization
  const initializeCollaboration = async (fileId) => {
    if (!isClient || !collaborationUtilsRef.current) {
      console.warn("⚠️ [COLLAB] Cannot initialize - missing requirements:", {
        isClient,
        hasCollabUtils: !!collaborationUtilsRef.current,
      });
      return null;
    }

    try {
      const ydoc = new Y.Doc();
      const ytext = ydoc.getText("monaco");

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

      // Status event logging
      provider.on("status", (event) => {
        setCollaborationStatus(event.status);

        if (event.status === "connected") {
          setErrorMessage("✅ Real-time collaboration enabled!");
          setTimeout(() => setErrorMessage(""), 3000);
        } else if (event.status === "disconnected") {
          console.warn("⚠️ [COLLAB] Disconnected from room:", roomId);
          setErrorMessage("⚠️ Real-time collaboration disconnected");
        }
      });

      // Sync event logging
      let initialSyncDone = false;
      provider.on("sync", (isSynced) => {
        setDocumentSynced(isSynced);

        if (isSynced && !initialSyncDone) {
          initialSyncDone = true;

          if (ytext.toString() === "" && initialContentRef.current) {
            ytext.insert(0, initialContentRef.current);
          } else if (ytext.toString() !== "") {
            const yjsContent = ytext.toString();
            if (yjsContent !== editorContent) {
              setEditorContent(yjsContent);
            }
          }
        }
      });

      // Awareness logging
      const { AwarenessManager, formatUserActivity } =
        collaborationUtilsRef.current;
      const awarenessManager = new AwarenessManager(provider, userId, userName);
      awarenessManagerRef.current = awarenessManager;

      // Connected users tracking
      provider.awareness.on("update", () => {
        const allStates = Array.from(provider.awareness.getStates().entries());

        const users = allStates
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
      setErrorMessage(`❌ Collaboration error: ${error.message}`);
      return null;
    }
  };

  //(5) Enhanced Monaco binding setup
  const setupMonacoBinding = (editor, monaco) => {
    if (
      !ytextRef.current ||
      !providerRef.current ||
      !awarenessManagerRef.current ||
      !collaborationUtilsRef.current
    ) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    try {
      const { setupEnhancedMonacoBinding } = collaborationUtilsRef.current;

      const binding = setupEnhancedMonacoBinding(
        ytextRef.current,
        editor,
        providerRef.current
      );

      monacoBindingRef.current = binding;

      // Cursor tracking
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
    } catch (error) {
      console.error("❌ [MONACO BINDING] Failed to setup binding:", {
        error: error.message,
        stack: error.stack,
      });
      setErrorMessage(`❌ Collaboration setup error: ${error.message}`);
    }
  };

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

  // Rest of the methods remain the same but with enhanced error messages and collaboration awareness
  const getUploadHeaders = () => {
    const headers = getAuthHeaders();
    delete headers["Content-Type"];
    return headers;
  };

  const handleSaveFile = async () => {
    if (!selectedFile || isPdf || isSaving) {
      console.warn("⚠️ [SAVE] Cannot save:", {
        hasSelectedFile: !!selectedFile,
        isPdf,
        isSaving,
      });
      return;
    }

    const isLocalFile = localFiles.has(selectedFile.id);
    let contentToSave = editorContent;

    // Get content from Yjs if collaboration is active
    if (ytextRef.current && !isLocalFile && documentSynced) {
      contentToSave = ytextRef.current.toString();
    } else {
    }

    setIsSaving(true);

    try {
      setErrorMessage("");

      if (isLocalFile) {
        const localFile = localFiles.get(selectedFile.id);

        // ... save logic ...
      } else {
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
      console.error("❌ [SAVE] Error saving file:", {
        error: error.message,
        stack: error.stack,
      });
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
    ) {
      console.warn("⚠️ [EXECUTION] Cannot execute:", {
        hasSelectedFile: !!selectedFile,
        canExecute: selectedFile
          ? canExecuteFile(selectedFile.originalName)
          : false,
        isExecuting,
      });
      return;
    }

    const languageId = getJudge0LanguageId(selectedFile.originalName);

    if (!languageId) {
      console.error("❌ [EXECUTION] Language not supported for execution");
      setExecutionError("Language not supported for execution");
      setShowOutput(true);
      return;
    }

    setIsExecuting(true);
    setExecutionOutput("");
    setExecutionError("");
    setShowOutput(true);

    try {
      // Get current content
      let fileContent = editorContent;
      if (
        ytextRef.current &&
        !localFiles.has(selectedFile.id) &&
        documentSynced
      ) {
        fileContent = ytextRef.current.toString();
      } else {
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
        console.error("❌ [EXECUTION] Execution failed:", data.error);
        setExecutionError(data.error || "Execution failed");
        setExecutionOutput(data.output || "");
      } else {
        setExecutionOutput(
          data.output || "Program executed successfully (no output)"
        );
        setExecutionError(data.error || "");
      }
    } catch (error) {
      console.error("❌ [EXECUTION] Error during execution:", {
        error: error.message,
        stack: error.stack,
      });
      setExecutionError(`Error: ${error.message}`);
      setExecutionOutput("");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleEditorChange = (value) => {
    // For local files, update React state
    if (selectedFile && localFiles.has(selectedFile.id)) {
      setEditorContent(value);
      setLocalFiles((prev) => {
        const newMap = new Map(prev);
        const localFile = newMap.get(selectedFile.id);
        newMap.set(selectedFile.id, { ...localFile, content: value });
        return newMap;
      });
    }
    // For server files with collaboration, Yjs handles the content
    // We only update state for display purposes (optional)
    else if (!isCollaborationEnabled) {
      setEditorContent(value);
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
    userId,
    userName,
    token,
    wsUrl: process.env.NEXT_PUBLIC_SOCKET_URL,
  };

  return (
    <>
      <div className="flex h-screen bg-gradient-to-br from-amber-900/20 to-amber-800/20 backdrop-blur-sm border border-amber-700/30 shadow-lg rounded-lg mx-2 sm:mx-3 md:mx-5 overflow-hidden">
        {/* Sidebar */}
        <div className="hidden md:flex">
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
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
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

          {/* Editor + Collaboration */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0">
            {/* Editor */}
            <div className="flex-1 min-w-0">
              {selectedFile ? (
                isPdf ? (
                  <div className="p-3 sm:p-4">
                    <iframe
                      src={downloadUrl}
                      className="w-full h-[60vh] md:h-[calc(100vh-200px)] rounded-lg border"
                    />
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    language={editorLanguage}
                    value={editorContent}
                    onChange={
                      canEdit && localFiles.has(selectedFile.id)
                        ? handleEditorChange
                        : undefined
                    }
                    onMount={handleEditorDidMount}
                    options={editorOptions}
                    theme="vs-dark"
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full text-center px-4">
                  <div>
                    <h3 className="text-amber-100 text-lg sm:text-xl mb-2">
                      Select a file to start
                    </h3>
                    <p className="text-amber-200/80 text-sm">
                      Choose a file from the sidebar to begin editing.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Collaboration Panel */}
            {isCollaborationEnabled && selectedFile && !isPdf && (
              <div className="hidden lg:flex w-72 border-l">
                <CollaborationPanel
                  connectedUsers={connectedUsers}
                  collaborationStatus={collaborationStatus}
                  currentUser={{ userId, userName }}
                  documentSynced={documentSynced}
                  roomId={`file_${selectedFile.id}_${projectId}`}
                />
              </div>
            )}
          </div>

          {/* Output */}
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
    </>
  );
}

export default CodeEditor;
