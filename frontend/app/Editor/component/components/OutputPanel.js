import React from "react";
import {
  Terminal,
  X,
  Maximize2,
  Minimize2,
  FileText,
  Bug,
  Play,
} from "lucide-react";
import { canExecuteFile, getJudge0LanguageId } from "./utils";

function OutputPanel({
  isOutputMaximized,
  setIsOutputMaximized,
  activeTab,
  setActiveTab,
  selectedFile,
  executionInput,
  setExecutionInput,
  isExecuting,
  executionOutput,
  executionError,
  onClose,
}) {
  return (
    <>
      {/* Mobile Overlay when maximized */}
      {isOutputMaximized && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" />
      )}

      <div
        className={`
        fixed md:static z-50
        bottom-0 md:bottom-auto
        left-0
        w-full
        ${isOutputMaximized ? "h-[90vh]" : "h-[45vh] md:h-1/2"}
        bg-slate-800/30
        border-t border-slate-700/50
        flex flex-col
        backdrop-blur-sm
        rounded-t-xl md:rounded-none
      `}
      >
        {/* Output Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 sm:p-3 border-b border-slate-700/30">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <div className="flex items-center">
              <Terminal className="w-5 h-5 mr-2 text-green-400 shrink-0" />
              <h3 className="text-slate-200 font-medium whitespace-nowrap">
                Execution Output
              </h3>
            </div>

            {selectedFile && canExecuteFile(selectedFile.originalName) && (
              <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded-md">
                Judge0 ID: {getJudge0LanguageId(selectedFile.originalName)}
              </span>
            )}

            {/* Tabs */}
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("output")}
                className={`px-2 py-1 text-xs rounded-md flex items-center transition-colors ${
                  activeTab === "output"
                    ? "bg-blue-600/50 text-blue-200"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <FileText className="w-3 h-3 mr-1" />
                Output
                {executionOutput && (
                  <span className="ml-1 w-1.5 h-1.5 bg-green-400 rounded-full" />
                )}
              </button>

              <button
                onClick={() => setActiveTab("errors")}
                className={`px-2 py-1 text-xs rounded-md flex items-center transition-colors ${
                  activeTab === "errors"
                    ? "bg-red-600/50 text-red-200"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <Bug className="w-3 h-3 mr-1" />
                Errors
                {executionError && (
                  <span className="ml-1 w-1.5 h-1.5 bg-red-400 rounded-full" />
                )}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOutputMaximized(!isOutputMaximized)}
              className="p-1 hover:bg-slate-600/50 rounded transition-colors"
              title={isOutputMaximized ? "Restore" : "Maximize"}
            >
              {isOutputMaximized ? (
                <Minimize2 className="w-4 h-4 text-slate-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-400" />
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-600/50 rounded transition-colors"
              title="Close output"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Input Section */}
        <div className="p-2 sm:p-3 border-b border-slate-700/30 bg-slate-800/20">
          <div className="flex items-center justify-between mb-2">
            <label className="text-slate-300 text-sm font-medium">
              Program Input (stdin)
            </label>
            <span className="text-xs text-slate-500">
              {executionInput.length} chars
            </span>
          </div>

          <textarea
            value={executionInput}
            onChange={(e) => setExecutionInput(e.target.value)}
            className="w-full h-14 sm:h-16 p-2 bg-slate-900/50 border border-slate-600/50 rounded-md text-slate-200 text-sm font-mono focus:outline-none focus:border-blue-400 resize-none placeholder-slate-500"
            placeholder="Enter input for your program here (if required)..."
          />
        </div>

        {/* Output Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {isExecuting ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mr-3" />
              <div className="text-center">
                <div className="text-slate-300 font-medium">
                  Executing code with Judge0...
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  This may take a few moments
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Output */}
              {activeTab === "output" && (
                <>
                  {executionOutput ? (
                    <pre className="bg-slate-900/60 p-3 sm:p-4 rounded-lg border border-slate-600/30 text-green-300 text-sm font-mono whitespace-pre-wrap overflow-x-auto max-h-[50vh] scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
                      {executionOutput}
                    </pre>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                      <div className="text-slate-400 text-sm italic">
                        No output yet. Click “Run” to execute.
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Errors */}
              {activeTab === "errors" && (
                <>
                  {executionError ? (
                    <pre className="bg-slate-900/60 p-3 sm:p-4 rounded-lg border border-red-600/30 text-red-300 text-sm font-mono whitespace-pre-wrap overflow-x-auto max-h-[50vh] scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
                      {executionError}
                    </pre>
                  ) : (
                    <div className="text-center py-12">
                      <Bug className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                      <div className="text-slate-400 text-sm italic">
                        No errors. Your code ran successfully!
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default OutputPanel;
