import React from 'react';
import { 
  Save, 
  Play, 
  FileText, 
  Users, 
  Wifi, 
  WifiOff, 
  Clock,
  Circle
} from 'lucide-react';

const Toolbar = ({ 
  selectedFile, 
  isPdf, 
  isSaving, 
  isExecuting, 
  onSave, 
  onExecute,
  // New collaboration props
  isCollaborationEnabled = false,
  collaborationStatus = 'disconnected',
  connectedUsersCount = 0,
  lastSaved = null
}) => {
  const canSave = selectedFile && !isPdf && !isSaving;
  const canExecute = selectedFile && !isPdf && !isExecuting && selectedFile.originalName;
  
  const getStatusIcon = () => {
    switch (collaborationStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'connecting':
        return <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />;
      default:
        return <WifiOff className="w-4 h-4 text-red-400" />;
    }
  };

  const getStatusText = () => {
    switch (collaborationStatus) {
      case 'connected':
        return 'Live';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Offline';
    }
  };

  const getStatusColor = () => {
    switch (collaborationStatus) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
        return 'text-yellow-400';
      default:
        return 'text-red-400';
    }
  };

  return (
    <div className="flex items-center justify-between bg-slate-800/50 border-b border-slate-700/50 px-4 py-2">
      {/* Left side - File info */}
      <div className="flex items-center space-x-4">
        {selectedFile ? (
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300 font-medium">
              {selectedFile.originalName}
            </span>
            {selectedFile.isLocal && (
              <span className="px-2 py-1 text-xs bg-orange-600/20 text-orange-300 rounded-md border border-orange-600/30">
                Local
              </span>
            )}
            {isPdf && (
              <span className="px-2 py-1 text-xs bg-blue-600/20 text-blue-300 rounded-md border border-blue-600/30">
                PDF
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-500">No file selected</span>
          </div>
        )}

        {/* Collaboration Status */}
        {selectedFile && !isPdf && !selectedFile.isLocal && (
          <div className="flex items-center space-x-2 px-3 py-1 rounded-md bg-slate-700/30 border border-slate-600/30">
            {getStatusIcon()}
            <span className={`text-sm ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            {isCollaborationEnabled && collaborationStatus === 'connected' && (
              <>
                <Circle className="w-1 h-1 fill-current text-slate-500" />
                <div className="flex items-center space-x-1">
                  <Users className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-400">
                    {connectedUsersCount + 1} user{connectedUsersCount !== 0 ? 's' : ''}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center space-x-2">
        {/* Last saved indicator */}
        {lastSaved && (
          <div className="text-xs text-slate-500 mr-2">
            Saved {new Date(lastSaved).toLocaleTimeString()}
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={onSave}
          disabled={!canSave}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            canSave
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
          }`}
          title={!selectedFile ? 'No file selected' : isPdf ? 'Cannot save PDF files' : 'Save file'}
        >
          <Save className={`w-4 h-4 ${isSaving ? 'animate-pulse' : ''}`} />
          <span>{isSaving ? 'Saving...' : 'Save'}</span>
        </button>

        {/* Execute Button */}
        <button
          onClick={onExecute}
          disabled={!canExecute}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            canExecute
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
          }`}
          title={
            !selectedFile
              ? 'No file selected'
              : isPdf
              ? 'Cannot execute PDF files'
              : isExecuting
              ? 'Code is running...'
              : 'Run code'
          }
        >
          <Play className={`w-4 h-4 ${isExecuting ? 'animate-pulse' : ''}`} />
          <span>{isExecuting ? 'Running...' : 'Run'}</span>
        </button>

        {/* Collaboration indicator dot */}
        {isCollaborationEnabled && selectedFile && !isPdf && !selectedFile.isLocal && (
          <div className="flex items-center">
            <div 
              className={`w-2 h-2 rounded-full ${
                collaborationStatus === 'connected' 
                  ? 'bg-green-400 animate-pulse' 
                  : collaborationStatus === 'connecting'
                  ? 'bg-yellow-400 animate-pulse'
                  : 'bg-red-400'
              }`}
              title={`Collaboration ${collaborationStatus}`}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Toolbar;