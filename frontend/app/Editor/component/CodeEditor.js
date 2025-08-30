import React, { useState, useEffect, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { useFileManager } from '../../context/FileManagerContext'; // Adjust path as needed
import { Folder, FolderOpen, File as FileIcon } from 'lucide-react'; // For icons
import { getFileIcon } from './FileManager'; // Import from FileManager if shared

function CodeEditor() {
  const { allFiles, folders: flatFolders, API_BASE, getAuthHeaders, fetchAllFiles, fetchFolders } = useFileManager();
  const [selectedFile, setSelectedFile] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [editorLanguage, setEditorLanguage] = useState('plaintext');
  const [isPdf, setIsPdf] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Build tree structure from flat folders and files
  const buildTree = () => {

    // Check for duplicate folder IDs
    const folderIds = flatFolders.map(f => f.id);
    const uniqueFolderIds = new Set(folderIds);
    if (folderIds.length !== uniqueFolderIds.size) {
      console.warn('Duplicate folder IDs detected:', 
        folderIds.filter((id, index) => folderIds.indexOf(id) !== index)
      );
    }

    // Check for duplicate file IDs
    const fileIds = allFiles.map(f => f.id);
    const uniqueFileIds = new Set(fileIds);
    if (fileIds.length !== uniqueFileIds.size) {
      console.warn('Duplicate file IDs detected:', 
        fileIds.filter((id, index) => fileIds.indexOf(id) !== index)
      );
    }

    const folderMap = {};
    const assignedFolders = new Set();

    // Initialize folderMap
    flatFolders.forEach(f => {
      if (f.id !== 'root') {
        folderMap[f.id] = { ...f, children: [], files: [] };
      }
    });

    // Assign children to parents
    flatFolders.forEach(f => {
      if (f.id !== 'root' && f.parent && !assignedFolders.has(f.id)) {
        const parentId = typeof f.parent === 'object' ? f.parent._id : f.parent;
        if (folderMap[parentId]) {
          folderMap[parentId].children.push(folderMap[f.id]);
          assignedFolders.add(f.id);
        } else {
          console.warn(`Parent folder ${parentId} not found for folder ${f.id}`);
        }
      }
    });

    const root = { id: 'root', name: 'Root', children: [], files: [] };
    flatFolders.forEach(f => {
      if (f.id !== 'root' && !f.parent && !assignedFolders.has(f.id)) {
        root.children.push(folderMap[f.id]);
        assignedFolders.add(f.id);
      }
    });

    // Assign files to their respective folders, deduplicating by id
    const assignedFiles = new Set();
    allFiles.forEach(file => {
      if (!assignedFiles.has(file.id)) {
        const folderId = file.folder ? file.folder.toString() : 'root';
        if (folderId === 'root') {
          root.files.push(file);
        } else if (folderMap[folderId]) {
          folderMap[folderId].files.push(file);
        }
        assignedFiles.add(file.id);
      }
    });

    // Sort children and files alphabetically
    const sortNode = (node) => {
      node.children.sort((a, b) => a.name.localeCompare(b.name));
      node.files.sort((a, b) => a.originalName.localeCompare(b.originalName));
      node.children.forEach(sortNode);
    };
    sortNode(root);

    // console.log('Tree structure:', JSON.stringify(root, null, 2));
    return root;
  };

  const tree = useMemo(buildTree, [flatFolders, allFiles]);

  // Load file content when selectedFile changes
  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile.id);
    } else {
      setEditorContent('');
      setEditorLanguage('plaintext');
      setIsPdf(false);
      setDownloadUrl('');
      setErrorMessage('');
    }
  }, [selectedFile]);

  async function loadFileContent(fileId) {
    try {
      setErrorMessage('');
      // console.log('Fetching file with ID:', fileId);

      const fileType = selectedFile.originalName.split('.').pop().toLowerCase();
      const textFileTypes = ['js', 'txt', 'json', 'html', 'css', 'py'];

      if (fileType === 'pdf') {
        setIsPdf(true);
        const response = await fetch(`${API_BASE}/${fileId}/download`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch download URL: ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.message || 'Failed to fetch download URL');
        }
        setDownloadUrl(data.downloadUrl);
        setEditorContent('');
        return;
      }

      if (!textFileTypes.includes(fileType)) {
        setErrorMessage(`File type (.${fileType}) is not supported in the code editor.`);
        setEditorContent('');
        setIsPdf(false);
        setDownloadUrl('');
        return;
      }

      setIsPdf(false);
      setDownloadUrl('');
      const response = await fetch(`${API_BASE}/${fileId}/content`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch file content: ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch file content');
      }

      setEditorContent(data.content || '');
      const languageMap = {
        js: 'javascript',
        json: 'json',
        html: 'html',
        css: 'css',
        txt: 'plaintext',
        py: 'python',
      };
      setEditorLanguage(languageMap[fileType] || 'plaintext');
      // console.log('File content loaded:', data.content);
    } catch (error) {
      // console.error('Failed to load file content:', error);
      setErrorMessage(`Error: ${error.message}. Please check if the file exists or you have access.`);
      setEditorContent('');
      setIsPdf(false);
      setDownloadUrl('');
    }
  }

  const TreeNode = ({ node, level = 0 }) => {
    const [open, setOpen] = useState(level === 0);

    return (
      <div className="select-none">
        <div
          style={{ paddingLeft: level * 16 + 'px' }}
          className="flex items-center py-1 bg-amber-700/40 text-amber-400 rounded border border-amber-600/30 hover:bg-amber-700/60 cursor-pointer"
          onClick={() => setOpen(!open)}
        >
          {node.children.length > 0 || node.files.length > 0 ? (
            open ? <FolderOpen className="w-4 h-4 mr-1 text-amber-400" /> : <Folder className="w-4 h-4 mr-1 text-amber-400" />
          ) : (
            <Folder className="w-4 h-4 mr-1 text-amber-400" />
          )}
          {node.name}
        </div>
        {open && (
          <>
            {node.children.map(child => (
              <TreeNode key={child.id} node={child} level={level + 1} />
            ))}
            {node.files.map((file, index) => (
              <div
                key={`${file.id}-${index}`}
                style={{ paddingLeft: (level + 1) * 16 + 'px' }}
                className={`flex items-center py-1 hover:bg-amber-700/60 hover:border-2 text-amber-400 hover:border-amber-300 cursor-pointer bg-amber-700/30 rounded-3xl border border-amber-600/30 ${selectedFile?.id === file.id ? 'bg-amber-700/20' : ''}`}
                onClick={() => setSelectedFile(file)}
              >
                {getFileIcon('file', file.originalName, 'w-4 h-4 mr-1 text-amber-400')}
                {file.originalName}
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[90vh] bg-gradient-to-r from-amber-900/20 to-amber-800/20 backdrop-blur-sm border border-amber-700/30 rounded-lg shadow-lg m-5 mb-0">
      <div className="w-[300px] overflow-y-auto border-r border-amber-600/30 p-3 bg-amber-700/20 rounded-lg">
        <h3 className="font-bold mb-2 text-amber-400 text-center">Project Files</h3>
        <TreeNode node={tree} />
      </div>
      <div className="flex-1 p-3">
        {errorMessage && <div className="text-red-400 mb-3">{errorMessage}</div>}
        {selectedFile ? (
          isPdf ? (
            <div className="text-amber-400">
              PDF files cannot be edited in the code editor.
              {downloadUrl ? (
                <iframe src={downloadUrl} className="w-full h-[80vh] border border-amber-600/30 rounded" title="PDF Viewer" />
              ) : (
                <span>Loading PDF...</span>
              )}
            </div>
          ) : (
            <Editor
              height="80vh"
              language={editorLanguage}
              value={editorContent}
              onChange={(value) => setEditorContent(value)}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
              className="border border-amber-600/30 rounded"
              theme="vs-dark"
            />
          )
        ) : (
          <div className="text-center py-20">
            <p className="text-amber-400">Select a file from the sidebar to view or edit its content.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CodeEditor;