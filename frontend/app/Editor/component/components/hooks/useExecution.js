import { useState } from 'react';
import { getJudge0LanguageId } from '../utils';

export function useExecution(API_BASE, getAuthHeaders, projectId) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOutput, setExecutionOutput] = useState('');
  const [executionError, setExecutionError] = useState('');
  const [executionInput, setExecutionInput] = useState('');
  const [showOutput, setShowOutput] = useState(false);

  const executeFile = async (selectedFile, editorContent) => {
    if (!selectedFile || isExecuting) return false;

    const languageId = getJudge0LanguageId(selectedFile.originalName);
    if (!languageId) {
      setExecutionError('Language not supported for execution');
      setShowOutput(true);
      return false;
    }

    setIsExecuting(true);
    setExecutionOutput('');
    setExecutionError('');
    setShowOutput(true);

    try {
      const response = await fetch(`${API_BASE}/execute`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fileName: selectedFile.originalName,
          content: editorContent,
          input: executionInput,
          projectId: projectId,
          languageId: languageId
        }),
      });

      if (!response.ok) {
        throw new Error(`Execution failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        setExecutionError(data.error || 'Execution failed');
        setExecutionOutput(data.output || '');
      } else {
        setExecutionOutput(data.output || 'Program executed successfully (no output)');
        setExecutionError(data.error || '');
      }
      
      return true;
    } catch (error) {
      setExecutionError(`Error: ${error.message}`);
      setExecutionOutput('');
      return false;
    } finally {
      setIsExecuting(false);
    }
  };

  const clearOutput = () => {
    setExecutionOutput('');
    setExecutionError('');
    setExecutionInput('');
  };

  return {
    executeFile,
    clearOutput,
    isExecuting,
    executionOutput,
    executionError,
    executionInput,
    setExecutionInput,
    showOutput,
    setShowOutput
  };
}