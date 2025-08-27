"use client";
import React, { useState } from 'react';

const CodeEditor = ({ projectData }) => {
  const [code, setCode] = useState('');

  return (
    <div className="p-4 m-4 border rounded-lg shadow-md bg-black/10 text-amber-50">
      <h2 className="text-xl font-bold mb-3">Code Editor</h2>
      <div className="bg-gray-900 rounded-lg p-4">
        <p className="text-green-400 mb-2">// Project ID: {projectData?.id}</p>
        <p className="text-gray-400 mb-4">// Project: {projectData?.name}</p>
        
        <textarea 
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full h-64 bg-gray-800 text-white p-3 rounded font-mono text-sm"
          placeholder="Start coding..."
        />
        
        <div className="mt-4 flex gap-2">
          <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
            Run Code
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;