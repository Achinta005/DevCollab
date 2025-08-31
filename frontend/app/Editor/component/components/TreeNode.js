import React, { useState } from 'react';
import { 
  Folder, FolderOpen, ChevronRight, ChevronDown, 
  MoreVertical, Trash2, Play 
} from 'lucide-react';
import { getFileIcon } from '../FileManager';
import { canExecuteFile } from './utils';

function TreeNode({ 
  node, level = 0, selectedFile, setSelectedFile, 
  showFileMenu, setShowFileMenu, onDeleteFile, isDeleting 
}) {
  const [open, setOpen] = useState(level === 0);

  return (
    <div className="select-none">
      <div
        style={{ paddingLeft: level * 16 + 'px' }}
        className="flex items-center py-2 px-2 text-slate-300 hover:bg-slate-700/60 cursor-pointer rounded-md transition-all duration-200 group"
        onClick={() => setOpen(!open)}
      >
        {node.children.length > 0 || node.files.length > 0 ? (
          open ? (
            <ChevronDown className="w-4 h-4 mr-1 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 mr-1 text-slate-400" />
          )
        ) : null}
        {node.children.length > 0 || node.files.length > 0 ? (
          open ? <FolderOpen className="w-4 h-4 mr-2 text-blue-400" /> : <Folder className="w-4 h-4 mr-2 text-blue-400" />
        ) : (
          <Folder className="w-4 h-4 mr-2 text-blue-400" />
        )}
        <span className="font-medium">{node.name}</span>
      </div>
      {open && (
        <>
          {node.children.map(child => (
            <TreeNode 
              key={child.id} 
              node={child} 
              level={level + 1}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              showFileMenu={showFileMenu}
              setShowFileMenu={setShowFileMenu}
              onDeleteFile={onDeleteFile}
              isDeleting={isDeleting}
            />
          ))}
          {node.files.map((file, index) => (
            <div
              key={`${file.id}-${index}`}
              style={{ paddingLeft: (level + 1) * 16 + 'px' }}
              className={`flex items-center justify-between py-2 px-2 hover:bg-slate-700/40 cursor-pointer rounded-md transition-all duration-200 group ${selectedFile?.id === file.id ? 'bg-blue-600/20 border-l-2 border-l-blue-400' : ''} ${file.isLocal ? 'bg-green-600/10 border-l-2 border-l-green-400' : ''}`}
              onClick={() => setSelectedFile(file)}
              title={file.isLocal ? 'Local file - not saved to server yet' : ''}
            >
              <div className="flex items-center min-w-0 flex-1">
                {getFileIcon('file', file.originalName, `w-4 h-4 mr-2 flex-shrink-0 ${file.isLocal ? 'text-green-400' : 'text-slate-400'}`)}
                <span className={`truncate text-sm ${selectedFile?.id === file.id ? 'text-white font-medium' : 'text-slate-300'}`}>
                  {file.originalName}
                </span>
                {file.isLocal && <span className="ml-1 text-xs text-green-400 flex-shrink-0">*</span>}
                {canExecuteFile(file.originalName) && (
                  <Play className="w-3 h-3 ml-2 text-green-400 flex-shrink-0" title="Executable file" />
                )}
              </div>
              <div className="relative flex-shrink-0 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFileMenu(showFileMenu === file.id ? null : file.id);
                  }}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-600/50 rounded transition-opacity"
                  title="File options"
                >
                  <MoreVertical className="w-3 h-3 text-slate-400" />
                </button>
                {showFileMenu === file.id && (
                  <div className="absolute right-0 top-6 bg-slate-800/95 border border-slate-600/50 rounded-lg shadow-lg py-1 min-w-[120px] z-10">
                    <button
                      onClick={(e) => onDeleteFile(file, e)}
                      className="w-full px-3 py-1 text-left text-red-300 hover:bg-red-600/20 flex items-center"
                      disabled={isDeleting}
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default TreeNode;