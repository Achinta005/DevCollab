"use client";
import React, { useState, useEffect } from "react";
import { getUserFromToken } from "../lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import ProjectInfo from "./component/ProjectInfo";
import Editor from "./component/CodeEditor";
import FileManager from "./component/FileManager";
import { FileManagerProvider } from "../context/FileManagerContext";

const UserProfile = () => {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const userData = getUserFromToken();
    if (userData) {
      setUser(userData);
      setMounted(true);
    } else {
      router.push("/Login");
      return;
    }

    // Get project data from URL parameters
    const projectId = searchParams.get("projectId");
    if (projectId) {
      const project = {
        id: projectId,
        currentUserId: userData.id,
      };

      setProjectData(project);
    } else {
      router.push("/");
    }
  }, [router, searchParams]);

  if (!mounted) return null;
  if (!user) return <p>No user data available</p>;
  if (!projectData) {
    return (
      <div className="bg-black/90 min-h-screen flex items-center justify-center">
        <div className="text-amber-50 text-xl">Loading project...</div>
      </div>
    );
  }

  return (
    <div className="bg-black/90 h-fit">
      {/* Header */}
      <div className="flex items-center justify-between p-5">
        <button
          className="bg-white/10 backdrop-blur-3xl text-amber-50 cursor-pointer p-2 rounded-lg hover:bg-white/20 transition-colors"
          onClick={() => router.push("/")}
        >
          ← HOME
        </button>

        <div className="text-amber-50 text-lg font-semibold">
          Welcome to DevCollab
        </div>

        <div className="text-amber-50 text-xl">Welcome {user.username}</div>
      </div>

      {/* Project Components */}

      <ProjectInfo projectData={projectData} />
      <FileManagerProvider projectData={projectData}>
        <FileManager projectData={projectData} />
        <Editor />
      </FileManagerProvider>
    </div>
  );
};

export default UserProfile;
