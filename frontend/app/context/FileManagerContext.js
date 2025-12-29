import { createContext, useContext, useState, useEffect } from "react";

const FileManagerContext = createContext();

export const FileManagerProvider = ({ children, projectData }) => {
  const [folders, setFolders] = useState({ hierarchy: [], flat: [] });
  const [allFiles, setAllFiles] = useState([]);
  const [error, setError] = useState(null);
  const projectId = projectData?.id;
  const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/files`;

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("token") : "mock-token"}`,
    "Content-Type": "application/json",
  });

const getUploadHeaders = () => ({
  Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("token") : "mock-token"}`,
  // No Content-Type - let browser set it for FormData
});

  const fetchFolders = async () => {
    try {
      const response = await fetch(`${API_BASE}/folders/project/${projectId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch folders");
      const data = await response.json();
      if (data.success) {
        setFolders({ hierarchy: data.folders?.hierarchy || [], flat: data.folders?.flat || [] });
      } else {
        throw new Error(data.message || "Failed to fetch folders");
      }
    } catch (error) {
      setError(error.message);
      console.error("Fetch folders error:", error);
    }
  };

  const fetchFolderContents = async (folderId) => {
    try {

      // For each time any folder is clicked this two api calls runs 
      const foldersResponse = await fetch(
        `${API_BASE}/folders/${folderId}/contents?projectId=${projectId}`,  //(1)
        { headers: getAuthHeaders() }
      );
      if (!foldersResponse.ok) throw new Error("Failed to fetch folder contents");
      const foldersData = await foldersResponse.json();
      if (!foldersData.success) throw new Error("Failed to fetch subfolders");
      const subfolders = foldersData.subfolders || [];

      const filesResponse = await fetch(
        `${API_BASE}/project/${projectId}?folderId=${folderId}`,  //(2)
        { headers: getAuthHeaders() }
      );
      if (!filesResponse.ok) throw new Error("Failed to fetch files");
      const filesData = await filesResponse.json();
      if (!filesData.success) throw new Error("Failed to fetch files");

      setAllFiles((prevFiles) => [
        ...prevFiles.filter((file) => file.folderId !== folderId),
        ...(filesData.files || []),
      ]);
      return { folders: subfolders, files: filesData.files || [] };
    } catch (error) {
      setError(error.message);
      console.error("Fetch folder contents error:", error);
    }

    // (1) Called for geting all subfolders under that folder(folderId) -- which clicked 
    // (2) Called for getting all files under that folder(folderId)  -- which clicked 
    // And This whole function returns all files and folders inside any folder based on its Id 
  };

  const fetchAllFiles = async () => {
    const allFiles = [];
    const traverseFolder = async (folderId) => {
      try {
        const response = await fetch(
          `${API_BASE}/folders/${folderId}/contents?projectId=${projectId}`, //(1)
          { headers: getAuthHeaders() }
        );
        if (!response.ok) throw new Error("Failed to fetch folder contents");
        const foldersData = await response.json();
        if (!foldersData.success) throw new Error("Failed to fetch subfolders");
        const subfolders = foldersData.subfolders || [];

        const filesResponse = await fetch(
          `${API_BASE}/project/${projectId}?folderId=${folderId}`,//(2)
          { headers: getAuthHeaders() }
        );
        if (!filesResponse.ok) throw new Error("Failed to fetch files");
        const filesData = await filesResponse.json();
        if (!filesData.success) throw new Error("Failed to fetch files");

        allFiles.push(...(filesData.files || []));
        for (const subfolder of subfolders) {
          await traverseFolder(subfolder._id);
        }
      } catch (error) {
        setError(error.message);
        console.error("Error fetching folder contents:", error);
      }
    };

    await traverseFolder("root");
    setAllFiles(allFiles);
  };

  useEffect(() => {
    if (projectId) {
      fetchFolders();
      fetchAllFiles();
    }
  }, [projectId]);

  return (
    <FileManagerContext.Provider
      value={{
        folders: folders.flat,
        allFiles,
        fetchFolders,
        fetchFolderContents,
        fetchAllFiles,
        API_BASE,
        getAuthHeaders,
        setError,
        projectId,
        getUploadHeaders
      }}
    >
      {children}
    </FileManagerContext.Provider>
  );
};

export const useFileManager = () => useContext(FileManagerContext);