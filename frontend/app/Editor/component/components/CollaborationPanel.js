import React from 'react';
import { Users, Circle, Eye } from 'lucide-react';

const CollaborationPanel = ({ connectedUsers, collaborationStatus, currentUser }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
        return 'text-yellow-400';
      case 'disconnected':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="w-64 bg-slate-800/50 border-l border-slate-700/50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center space-x-2 mb-3">
          <Users className="w-4 h-4 text-slate-300" />
          <span className="text-sm font-medium text-slate-300">Collaboration</span>
        </div>
        
        {/* Status */}
        <div className="flex items-center space-x-2">
          <Circle className={`w-2 h-2 fill-current ${getStatusColor(collaborationStatus)}`} />
          <span className={`text-xs ${getStatusColor(collaborationStatus)}`}>
            {getStatusText(collaborationStatus)}
          </span>
        </div>
      </div>

      {/* Connected Users */}
      <div className="flex-1 p-4">
        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
          Active Users ({connectedUsers.length + 1})
        </h4>
        
        {/* Current User */}
        <div className="mb-3">
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-blue-600/20 border border-blue-600/30">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-xs font-medium text-white">
                {currentUser.userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-slate-200 truncate">
                  {currentUser.userName}
                </span>
                <span className="text-xs text-blue-400">(You)</span>
              </div>
              <div className="flex items-center space-x-1 mt-1">
                <Eye className="w-3 h-3 text-green-400" />
                <span className="text-xs text-slate-400">Editing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Other Connected Users */}
        <div className="space-y-2">
          {connectedUsers.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-500">
                No other users connected
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Share your project to collaborate
              </p>
            </div>
          ) : (
            connectedUsers.map((user) => (
              <div
                key={user.clientId}
                className="flex items-center space-x-3 p-2 rounded-lg bg-slate-700/30"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: user.color || '#6B7280' }}
                >
                  {user.userName ? user.userName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-300 truncate">
                      {user.userName || 'Anonymous'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 mt-1">
                    <Circle className="w-2 h-2 fill-current text-green-400" />
                    <span className="text-xs text-slate-400">Online</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Collaboration Info */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="text-xs text-slate-500 space-y-1">
          <div className="flex items-center space-x-2">
            <Circle className="w-2 h-2 fill-current text-blue-400" />
            <span>Real-time editing</span>
          </div>
          <div className="flex items-center space-x-2">
            <Circle className="w-2 h-2 fill-current text-green-400" />
            <span>Live cursors</span>
          </div>
          <div className="flex items-center space-x-2">
            <Circle className="w-2 h-2 fill-current text-purple-400" />
            <span>Conflict resolution</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollaborationPanel;