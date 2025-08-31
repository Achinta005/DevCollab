import React, { useState, useEffect, useMemo } from "react";
import Editor from "@monaco-editor/react";
import { useFileManager } from "../../context/FileManagerContext";
import { Code } from "lucide-react";

// Import sub-components
import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import OutputPanel from "./components/OutputPanel";
import NewFileModal from "./components/NewFileModel";

// Import utilities and constants
import { JUDGE0_LANGUAGES } from "./components/constants";
import {
  canExecuteFile,
  getJudge0LanguageId,
  getLanguageFromFileType,
  buildFileTree,
  getTemplateContent,
} from "./components/utils";

function CodeEditor({userId,userName}) {
  const {
    allFiles,
    folders: flatFolders,
    getAuthHeaders,
    fetchAllFiles,
    fetchFolders,
    projectId,
  } = useFileManager();
  const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/editor`;
  // File state
  const [selectedFile, setSelectedFile] = useState(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorLanguage, setEditorLanguage] = useState("plaintext");
  const [isPdf, setIsPdf] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [localFiles, setLocalFiles] = useState(new Map());

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

  const token=localStorage.getItem('token')
  // Build file tree
  const tree = useMemo(
    () => buildFileTree(flatFolders, allFiles, localFiles),
    [flatFolders, allFiles, localFiles]
  );

  // Load file content when selected file changes
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
    }
  }, [selectedFile]);

  // Close file menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowFileMenu(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);
  // File operations (moved to separate file handlers)
  const loadFileContent = async (fileId) => {
    try {
      setErrorMessage("");

      // Check if it's a local file first
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
        `Error: ${error.message}. Please check if the file exists or you have access.`
      );
      setEditorContent("");
      setIsPdf(false);
      setDownloadUrl("");
    }
  };

  const getUploadHeaders = () => {
    const headers = getAuthHeaders();
    delete headers["Content-Type"]; // Let browser set multipart/form-data automatically
    return headers;
  };

  const handleSaveFile = async () => {
    if (!selectedFile || isPdf || isSaving) return;

    const isLocalFile = localFiles.has(selectedFile.id);

    if (isLocalFile) {
      // Save local file to backend
      if (!window.confirm("Save this new file to the server?")) return;
    } else {
      // Update existing file
      if (
        !window.confirm("Are you sure you want to save changes to this file?")
      )
        return;
    }

    setIsSaving(true);
    try {
      setErrorMessage("");
      const content = typeof editorContent === "string" ? editorContent : "";

      if (isLocalFile) {
        // Create file on server with content
        const localFile = localFiles.get(selectedFile.id);
        const formData = new FormData();
        formData.append("originalName", localFile.originalName);
        formData.append("folder", localFile.folder);

        // Create a blob with the actual content and proper filename
        const contentBlob = new Blob([content], { type: "text/plain" });
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

        // Remove from local files and refresh to get the server version
        setLocalFiles((prev) => {
          const newMap = new Map(prev);
          newMap.delete(selectedFile.id);
          return newMap;
        });

        await fetchAllFiles();
        setSelectedFile(null); // Deselect to avoid confusion
        setErrorMessage("File saved to server successfully!");
      } else {
        // Update existing file
        const response = await fetch(
          `${API_BASE}/${selectedFile.id}/content/submit`,
          {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ content }),
          }
        );

        if (!response.ok)
          throw new Error(`Failed to save file: ${response.statusText}`);
        const data = await response.json();
        if (!data.success)
          throw new Error(data.message || "Failed to save file");
        setErrorMessage("File saved successfully!");
      }

      setTimeout(() => setErrorMessage(""), 3000);
    } catch (error) {
      setErrorMessage(`Error saving file: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFile = async (file, event) => {
    event.stopPropagation(); // Prevent file selection when clicking delete
    setShowFileMenu(null); // Close the menu

    const isLocalFile = localFiles.has(file.id);

    if (isLocalFile) {
      // Delete local file
      if (
        !window.confirm(
          `Are you sure you want to delete "${file.originalName}"? This action cannot be undone.`
        )
      ) {
        return;
      }

      // Remove from local files
      setLocalFiles((prev) => {
        const newMap = new Map(prev);
        newMap.delete(file.id);
        return newMap;
      });

      // Deselect if it was selected
      if (selectedFile?.id === file.id) {
        setSelectedFile(null);
      }

      setErrorMessage("Local file deleted successfully!");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    // Delete server file
    if (
      !window.confirm(
        `Are you sure you want to delete "${file.originalName}" from the server? This action cannot be undone.`
      )
    ) {
      return;
    }

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

      // Deselect if it was selected
      if (selectedFile?.id === file.id) {
        setSelectedFile(null);
      }

      // Refresh files to update the UI
      await fetchAllFiles();
      setErrorMessage("File deleted successfully!");
      setTimeout(() => setErrorMessage(""), 3000);
    } catch (error) {
      setErrorMessage(`Error deleting file: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchAllFiles();
      await fetchFolders();
      setErrorMessage("Files refreshed successfully!");
      setTimeout(() => setErrorMessage(""), 3000);
    } catch (error) {
      setErrorMessage(`Error refreshing files: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateFile = () => {
    if (!projectId) {
      setErrorMessage(
        "Error: Project ID is missing. Please ensure you are in a valid project context."
      );
      return;
    }
    if (!newFileName) {
      setErrorMessage("Please enter a file name");
      return;
    }

    try {
      setErrorMessage("");

      // Create a local file object
      const localFileId = `local_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const fileName = `${newFileName}.${newFileType}`;

      // Get language-specific template content
      const getTemplateContent = (fileType) => {
        const templates = {
          // C/C++
          c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
          cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',

          // Java
          java: `public class ${newFileName} {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,

          // Python
          py: 'print("Hello, World!")',
          py2: 'print "Hello, World!"',

          // JavaScript/TypeScript
          js: 'console.log("Hello, World!");',
          ts: 'console.log("Hello, World!");',

          // Other languages
          cs: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, World!");\n    }\n}',
          go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}',
          rs: 'fn main() {\n    println!("Hello, World!");\n}',
          rb: 'puts "Hello, World!"',
          php: '<?php\necho "Hello, World!\\n";\n?>',
          swift: 'print("Hello, World!")',
          kt: 'fun main() {\n    println("Hello, World!")\n}',
          scala:
            'object HelloWorld {\n  def main(args: Array[String]): Unit = {\n    println("Hello, World!")\n  }\n}',
          hs: 'main :: IO ()\nmain = putStrLn "Hello, World!"',
          sh: '#!/bin/bash\necho "Hello, World!"',
          pas: "program HelloWorld;\nbegin\n  writeln('Hello, World!');\nend.",
          lua: 'print("Hello, World!")',
          r: 'cat("Hello, World!\\n")',
          pl: 'print "Hello, World!\\n";',
          fs: 'printfn "Hello, World!"',
          vb: 'Module HelloWorld\n    Sub Main()\n        Console.WriteLine("Hello, World!")\n    End Sub\nEnd Module',
          sql: "-- Hello World SQL Query\nSELECT 'Hello, World!' AS greeting;",

          // Markup and data
          html: "<!DOCTYPE html>\n<html>\n<head>\n    <title>Hello World</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>",
          css: "/* Hello World CSS */\nbody {\n    font-family: Arial, sans-serif;\n}\n\n.greeting {\n    color: blue;\n}",
          json: '{\n  "message": "Hello, World!"\n}',
          xml: '<?xml version="1.0" encoding="UTF-8"?>\n<greeting>Hello, World!</greeting>',
          md: "# Hello World\n\nThis is a markdown file.",
          yaml: "greeting: Hello, World!\nversion: 1.0",
          yml: "greeting: Hello, World!\nversion: 1.0",

          // Default
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

      // Add to local files map
      setLocalFiles((prev) => new Map(prev).set(localFileId, localFile));

      // Select the newly created file
      setSelectedFile(localFile);

      // Close modal and reset form
      setIsNewFileModalOpen(false);
      setNewFileName("");
      setNewFileType("js");
      setNewFileFolder("root");
      setErrorMessage(
        "File created locally! Edit and save to upload to server."
      );
      setTimeout(() => setErrorMessage(""), 3000);
    } catch (error) {
      setErrorMessage(`Error creating file: ${error.message}`);
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
      const fileContent = editorContent;

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
  };

  return (
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
        {/* Toolbar */}
        <Toolbar
          selectedFile={selectedFile}
          isPdf={isPdf}
          isSaving={isSaving}
          isExecuting={isExecuting}
          onSave={handleSaveFile}
          onExecute={handleExecuteFile}
        />

        {/* Editor Area */}
        <div
          className={`flex-1 ${
            showOutput && !isOutputMaximized ? "h-1/2" : ""
          }`}
        >
          {/* Status/Error Bar */}
          {errorMessage && (
            <div
              className={`mx-4 mt-3 p-3 rounded-lg ${
                errorMessage.includes("success") ||
                errorMessage.includes("created")
                  ? "bg-green-600/20 text-green-300 border border-green-600/30"
                  : "bg-red-600/20 text-red-300 border border-red-600/30"
              }`}
            >
              <div className="flex items-center">
                <div
                  className={`w-2 h-2 rounded-full mr-2 ${
                    errorMessage.includes("success") ||
                    errorMessage.includes("created")
                      ? "bg-green-400"
                      : "bg-red-400"
                  }`}
                ></div>
                {errorMessage}
              </div>
            </div>
          )}

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
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mr-3"></div>
                    <span className="text-slate-400">Loading PDF...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full">
                <Editor
                  height={
                    showOutput && !isOutputMaximized
                      ? "calc(50vh - 100px)"
                      : "calc(100vh - 120px)"
                  }
                  language={editorLanguage}
                  value={editorContent}
                  onChange={handleEditorChange}
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
                  Select a file from the sidebar to start editing.
                </p>
              </div>
            </div>
          )}
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
  );
}

export default CodeEditor;
