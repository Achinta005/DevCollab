import { JUDGE0_LANGUAGES } from './constants';

export const canExecuteFile = (fileName) => {
  if (!fileName) return false;
  const ext = fileName.split('.').pop().toLowerCase();
  return JUDGE0_LANGUAGES.some(lang => lang.extension === ext);
};

export const getJudge0LanguageId = (fileName) => {
  if (!fileName) return null;
  const ext = fileName.split('.').pop().toLowerCase();
  const language = JUDGE0_LANGUAGES.find(lang => lang.extension === ext);
  return language ? language.id : null;
};

export const getLanguageFromFileType = (fileType) => {
  const judge0Lang = JUDGE0_LANGUAGES.find(lang => lang.extension === fileType);
  if (judge0Lang) {
    return judge0Lang.monacoLang;
  }

  const fallbackMap = {
    html: 'html', css: 'css', json: 'json', xml: 'xml',
    md: 'markdown', yaml: 'yaml', yml: 'yaml', txt: 'plaintext'
  };
  
  return fallbackMap[fileType] || 'plaintext';
};

export const buildFileTree = (flatFolders, allFiles, localFiles) => {
  const folderMap = {};
  const assignedFolders = new Set();

  // Build folder map
  flatFolders.forEach(f => {
    if (f.id !== 'root') {
      folderMap[f.id] = { ...f, children: [], files: [] };
    }
  });

  // Assign child folders to parents
  flatFolders.forEach(f => {
    if (f.id !== 'root' && f.parent && !assignedFolders.has(f.id)) {
      const parentId = typeof f.parent === 'object' ? f.parent._id : f.parent;
      if (folderMap[parentId]) {
        folderMap[parentId].children.push(folderMap[f.id]);
        assignedFolders.add(f.id);
      }
    }
  });

  // Create root folder
  const root = { id: 'root', name: 'Root', children: [], files: [] };
  flatFolders.forEach(f => {
    if (f.id !== 'root' && !f.parent && !assignedFolders.has(f.id)) {
      root.children.push(folderMap[f.id]);
      assignedFolders.add(f.id);
    }
  });

  // Combine server files with local files
  const combinedFiles = [...allFiles];
  localFiles.forEach((localFile, localId) => {
    if (!allFiles.find(f => f.id === localId)) {
      combinedFiles.push(localFile);
    }
  });

  // Assign files to folders
  const assignedFiles = new Set();
  combinedFiles.forEach(file => {
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

  // Sort nodes
  const sortNode = (node) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.originalName.localeCompare(b.originalName));
    node.children.forEach(sortNode);
  };
  sortNode(root);
  
  return root;
};

export const getTemplateContent = (fileType, fileName) => {
  const templates = {
    'c': '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
    'cpp': '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',
    'java': `public class ${fileName} {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
    'py': 'print("Hello, World!")',
    'js': 'console.log("Hello, World!");',
    'ts': 'console.log("Hello, World!");',
    'html': '<!DOCTYPE html>\n<html>\n<head>\n    <title>Hello World</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>',
    'css': '/* Hello World CSS */\nbody {\n    font-family: Arial, sans-serif;\n}',
    'json': '{\n  "message": "Hello, World!"\n}',
    'txt': 'Hello, World!'
  };
  
  return templates[fileType] || `// New ${fileType} file\n`;
};