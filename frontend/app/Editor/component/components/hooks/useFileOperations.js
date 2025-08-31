import { useState } from 'react';

export function useFileOperations(API_BASE, getAuthHeaders, fetchAllFiles, projectId) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getUploadHeaders = () => {
    const headers = getAuthHeaders();
    delete headers['Content-Type']; // Let browser set multipart/form-data automatically
    return headers;
  };

  const saveFile = async (selectedFile, editorContent, localFiles, setLocalFiles, setErrorMessage) => {
    if (!selectedFile || isSaving) return false;

    const isLocalFile = localFiles.has(selectedFile.id);
    
    if (isLocalFile) {
      if (!window.confirm('Save this new file to the server?')) return false;
    } else {
      if (!window.confirm('Are you sure you want to save changes to this file?')) return false;
    }

    setIsSaving(true);
    try {
      setErrorMessage('');
      const content = typeof editorContent === 'string' ? editorContent : '';

      if (isLocalFile) {
        // Create file on server with content
        const localFile = localFiles.get(selectedFile.id);
        const formData = new FormData();
        formData.append('originalName', localFile.originalName);
        formData.append('folder', localFile.folder);
        
        // Create a blob with the actual content and proper filename
        const contentBlob = new Blob([content], { type: 'text/plain' });
        formData.append('file', contentBlob, localFile.originalName);

        const response = await fetch(`${API_BASE}/upload/${projectId}`, {
          method: 'POST',
          headers: getUploadHeaders(),
          body: formData,
        });

        if (!response.ok) throw new Error(`Failed to save file: ${response.statusText}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Failed to save file');

        // Remove from local files and refresh to get the server version
        setLocalFiles(prev => {
          const newMap = new Map(prev);
          newMap.delete(selectedFile.id);
          return newMap;
        });

        await fetchAllFiles();
        setErrorMessage('File saved to server successfully!');
        return true;
      } else {
        // Update existing file
        const response = await fetch(`${API_BASE}/${selectedFile.id}/content/submit`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ content }),
        });

        if (!response.ok) throw new Error(`Failed to save file: ${response.statusText}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Failed to save file');
        setErrorMessage('File saved successfully!');
        return true;
      }
    } catch (error) {
      setErrorMessage(`Error saving file: ${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const deleteFile = async (file, setSelectedFile, setLocalFiles, setErrorMessage) => {
    const isLocalFile = file.isLocal;
    
    if (isLocalFile) {
      if (!window.confirm(`Are you sure you want to delete "${file.originalName}"? This action cannot be undone.`)) {
        return false;
      }
      
      // Remove from local files
      setLocalFiles(prev => {
        const newMap = new Map(prev);
        newMap.delete(file.id);
        return newMap;
      });

      setErrorMessage('Local file deleted successfully!');
      setTimeout(() => setErrorMessage(''), 3000);
      return true;
    }

    if (!window.confirm(`Are you sure you want to delete "${file.originalName}" from the server? This action cannot be undone.`)) {
      return false;
    }

    setIsDeleting(true);
    try {
      setErrorMessage('');
      
      const response = await fetch(`${API_BASE}/${file.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete file: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to delete file');
      }

      // Refresh files to update the UI
      await fetchAllFiles();
      setErrorMessage('File deleted successfully!');
      setTimeout(() => setErrorMessage(''), 3000);
      return true;
    } catch (error) {
      setErrorMessage(`Error deleting file: ${error.message}`);
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const refreshFiles = async (fetchFolders, setErrorMessage) => {
    setIsRefreshing(true);
    try {
      await fetchAllFiles();
      await fetchFolders();
      setErrorMessage('Files refreshed successfully!');
      setTimeout(() => setErrorMessage(''), 3000);
      return true;
    } catch (error) {
      setErrorMessage(`Error refreshing files: ${error.message}`);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    saveFile,
    deleteFile,
    refreshFiles,
    isSaving,
    isDeleting,
    isRefreshing
  };
}