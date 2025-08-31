import React from 'react';
import { Plus, X, Play, FileText } from 'lucide-react';
import { JUDGE0_LANGUAGES } from './constants';

function NewFileModal({ 
  isOpen, 
  onClose, 
  newFileName, 
  setNewFileName, 
  newFileType, 
  setNewFileType, 
  newFileFolder, 
  setNewFileFolder, 
  flatFolders, 
  onCreate 
}) {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate();
  };

  const isExecutable = JUDGE0_LANGUAGES.find(lang => lang.extension === newFileType);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-slate-800/95 p-6 rounded-xl border border-slate-600/50 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-slate-200 text-xl font-semibold flex items-center">
            <Plus className="w-5 h-5 mr-2 text-blue-400" />
            Create New File
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-600/50 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              File Name
            </label>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="w-full p-3 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:border-blue-400 transition-colors placeholder-slate-500"
              placeholder="Enter file name (without extension)"
              required
              autoFocus
            />
            {newFileName && (
              <div className="mt-1 text-xs text-slate-400">
                Preview: <span className="text-slate-300">{newFileName}.{newFileType}</span>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              File Type & Language
            </label>
            <select
              value={newFileType}
              onChange={(e) => setNewFileType(e.target.value)}
              className="w-full p-3 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:border-blue-400 transition-colors"
            >
              <optgroup label="Executable Languages (Judge0)">
                {JUDGE0_LANGUAGES.filter(lang => lang.extension !== 'txt').map(lang => (
                  <option key={lang.id} value={lang.extension}>
                    {lang.name} (.{lang.extension})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Markup & Data Files">
                <option value="html">HTML (.html)</option>
                <option value="css">CSS (.css)</option>
                <option value="json">JSON (.json)</option>
                <option value="xml">XML (.xml)</option>
                <option value="md">Markdown (.md)</option>
                <option value="yaml">YAML (.yaml)</option>
                <option value="txt">Plain Text (.txt)</option>
              </optgroup>
            </select>
            
            <div className="mt-2 p-2 rounded-md bg-slate-700/30">
              <div className="flex items-center text-xs">
                {isExecutable ? (
                  <div className="flex items-center text-green-400">
                    <Play className="w-3 h-3 mr-1" />
                    <span>Executable with Judge0 (Language ID: {isExecutable.id})</span>
                  </div>
                ) : (
                  <div className="flex items-center text-slate-400">
                    <FileText className="w-3 h-3 mr-1" />
                    <span>Text/Markup file (not executable)</span>
                  </div>
                )}
              </div>
              {isExecutable && (
                <div className="text-xs text-slate-500 mt-1">
                  Monaco Language: {isExecutable.monacoLang}
                </div>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Folder Location
            </label>
            <select
              value={newFileFolder}
              onChange={(e) => setNewFileFolder(e.target.value)}
              className="w-full p-3 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:border-blue-400 transition-colors"
            >
              <option value="root">📁 Root</option>
              {flatFolders.map(folder => (
                folder.id !== 'root' && (
                  <option key={folder.id} value={folder.id}>
                    📁 {folder.name}
                  </option>
                )
              ))}
            </select>
          </div>

          <div className="flex justify-end mt-6 space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-600/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600/50 text-blue-100 rounded-lg hover:bg-blue-600/70 transition-colors disabled:opacity-50"
              disabled={!newFileName.trim()}
            >
              Create File
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewFileModal;
