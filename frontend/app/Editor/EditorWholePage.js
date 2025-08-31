"use client";
import React, { useState, useEffect } from "react";
import { getUserFromToken } from "../lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import ProjectInfo from "./component/ProjectInfo";
import FileManager from "./component/FileManager";
import { FileManagerProvider } from "../context/FileManagerContext";
import CodeEditor from "./component/CodeEditor";
import { userService } from "../../services";

const UserProfile = () => {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Load user from token
  useEffect(() => {
    const tokendata = getUserFromToken();
    if (tokendata) {
      setUser(tokendata);
      setMounted(true);
    } else {
      router.push("/Login");
    }
  }, [router]);

  // Fetch full user profile after token data is set
  useEffect(() => {
    if (!user || !user.username) return;

    const loadUserData = async () => {
      try {
        const data = await userService.getProfile(user.username);
        setUserData(data.user || data);
      } catch (error) {
        console.error("Failed to load user data", error);
      }
    };
    loadUserData();
  }, [user]);

  // Get project data after userData is available
  useEffect(() => {
    const projectId = searchParams.get("projectId");
    if (projectId && userData?.id) {
      setProjectData({
        id: projectId,
        currentUserId: userData.id,
      });
    }
  }, [searchParams, userData]);

  if (!mounted) return null;
  if (!user) return <p>No user data available</p>;
  if (!userData || !projectData) {
    return (
      <div className="bg-black/90 min-h-screen flex items-center justify-center">
        <div className="text-amber-50 text-xl">Loading project...</div>
      </div>
    );
  }

  return (
    <div className="bg-black/90 h-fit">
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

      <ProjectInfo projectData={projectData} />
      <FileManagerProvider projectData={projectData}>
        <FileManager projectData={projectData} />
        <CodeEditor userId={userData.id} userName={userData.username} />
      </FileManagerProvider>
    </div>
  );
};

export default UserProfile;
