"use client";
import React, { useState, useEffect } from "react";
import { getUserFromToken } from "../lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import ProjectInfo from "./component/ProjectInfo";
import CodeEditor from "./component/CodeEditor";

const UserProfile = () => {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Get user data
    const userData = getUserFromToken();
    if (userData) {
      setUser(userData);
      setMounted(true);
    } else {
      router.push("/Login");
      return;
    }

    // Get project data from URL parameters
    const projectId = searchParams.get('projectId');
    if (projectId) {
      const project = {
        id: projectId,
        name: searchParams.get('name'),
        description: searchParams.get('description'),
        inviteCode: searchParams.get('inviteCode'),
        owner: {
          id: searchParams.get('ownerId'),
          name: searchParams.get('ownerName')
        },
        collaborators: parseInt(searchParams.get('collaborators')) || 0,
        files: parseInt(searchParams.get('files')) || 0,
        visibility: searchParams.get('visibility'),
        createdAt: searchParams.get('createdAt')
      };

      setProjectData(project);
    } else {
      router.push('/');
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
    <div className="bg-black/90 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-5">
        <button
          className="bg-white/10 backdrop-blur-3xl text-amber-50 cursor-pointer p-2 rounded-lg hover:bg-white/20 transition-colors"
          onClick={() => router.push("/")}
        >
          ← HOME
        </button>
        
        <div className="text-amber-50 text-lg font-semibold">
          Editor: {projectData.name}
        </div>
        
        <div className="text-amber-50 text-sm">
          Welcome, {user.username}
        </div>
      </div>
      {/* Project Components */}
      <ProjectInfo projectData={projectData} />
      <CodeEditor projectData={projectData} />
    </div>
  );
};

export default UserProfile;