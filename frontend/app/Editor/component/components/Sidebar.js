import React, { useState } from "react";
import {
  Folder,
  FolderOpen,
  RefreshCw,
  Plus,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Trash2,
  Layers,
  Play,
} from "lucide-react";
import { getFileIcon } from "../FileManager";
import TreeNode from "./TreeNode";

function Sidebar({
  tree,
  selectedFile,
  setSelectedFile,
  sidebarCollapsed,
  setSidebarCollapsed,
  showFileMenu,
  setShowFileMenu,
  onRefresh,
  onNewFile,
  onDeleteFile,
  isRefreshing,
  isDeleting,
  projectId,
}) {
  return (
    <>
      {/* Mobile Overlay (only when sidebar is open) */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      <div
        className={`
        fixed md:static z-50
        h-full
        ${sidebarCollapsed ? "w-12" : "w-72 sm:w-80"}
        md:${sidebarCollapsed ? "w-12" : "w-80"}
        transition-all duration-300
        bg-slate-800/50 border-r border-slate-700/50 backdrop-blur-sm
        flex flex-col
        rounded-none md:rounded-l-lg
      `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-700/50">
          {!sidebarCollapsed && (
            <div className="flex items-center min-w-0">
              <Layers className="w-5 h-5 mr-2 text-blue-400 shrink-0" />
              <h3 className="font-semibold text-slate-200 truncate">Files</h3>
            </div>
          )}

          <div className="flex space-x-1">
            {!sidebarCollapsed && (
              <>
                <button
                  onClick={onRefresh}
                  className={`p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-colors ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                  title="Refresh Files"
                  disabled={isRefreshing}
                >
                  <RefreshCw className="w-4 h-4 text-slate-300" />
                </button>

                <button
                  onClick={onNewFile}
                  className="p-2 bg-blue-600/50 hover:bg-blue-600/70 rounded-lg transition-colors"
                  title="New File"
                  disabled={!projectId}
                >
                  <Plus className="w-4 h-4 text-slate-200" />
                </button>
              </>
            )}

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-colors"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <ChevronRight
                className={`w-4 h-4 text-slate-300 transition-transform ${
                  !sidebarCollapsed ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* File Tree */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
            <TreeNode
              node={tree}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              showFileMenu={showFileMenu}
              setShowFileMenu={setShowFileMenu}
              onDeleteFile={onDeleteFile}
              isDeleting={isDeleting}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default Sidebar;
