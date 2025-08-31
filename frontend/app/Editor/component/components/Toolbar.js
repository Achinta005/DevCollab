import React from 'react';
import { Save, Play, Square, Code, Trash2 } from 'lucide-react';
import { canExecuteFile, getJudge0LanguageId } from './utils';

function Toolbar({ 
  selectedFile, 
  isPdf, 
  isSaving, 
  isExecuting, 
  onSave, 
  onExecute,
  onDelete 
}) {
  if (!selectedFile || isPdf) {
    return (
      <div className="h-14 bg-slate-800/30 border-b border-slate-700/50 flex items-center justify-between px-4">
        <div className="flex items-center">
          {selectedFile ? (
            <span className="text-slate-400">PDF Preview Mode</span>
          ) : (
            <span className="text-slate-400">No file selected</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-14 bg-slate-800/30 border-b border-slate-700/50 flex items-center justify-between px-4">
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <Code className="w-5 h-5 mr-2 text-blue-400" />
          <span className="text-slate-200 font-medium">{selectedFile.originalName}</span>
          {selectedFile.isLocal && (
            <span className="ml-2 px-2 py-1 text-xs bg-green-600/30 text-green-300 rounded-md">
              Local
            </span>
          )}
          {canExecuteFile(selectedFile.originalName) && (
            <span className="ml-2 px-2 py-1 text-xs bg-blue-600/30 text-blue-300 rounded-md">
              Executable
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {canExecuteFile(selectedFile.originalName) && (
          <button
            onClick={onExecute}
            className={`flex items-center px-4 py-2 bg-green-600/50 text-green-100 rounded-lg transition-colors hover:bg-green-600/70 ${isExecuting ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isExecuting}
            title={`Run with Judge0 (Language ID: ${getJudge0LanguageId(selectedFile.originalName)})`}
          >
            {isExecuting ? <Square className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isExecuting ? 'Running...' : 'Run'}
          </button>
        )}
        
        <button
          onClick={onSave}
          className={`flex items-center px-4 py-2 bg-blue-600/50 text-blue-100 rounded-lg transition-colors hover:bg-blue-600/70 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isSaving}
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : selectedFile.isLocal ? 'Save to Server' : 'Save'}
        </button>

        <button
          onClick={onDelete}
          className="flex items-center px-3 py-2 bg-red-600/50 text-red-100 rounded-lg transition-colors hover:bg-red-600/70"
          title="Delete file"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default Toolbar;