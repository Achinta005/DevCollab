"use client";
import React, { useState, useEffect } from "react";
import { getUserFromToken } from "../lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import ProjectInfo from "./component/ProjectInfo";
import FileManager from "./component/FileManager";
import { FileManagerProvider } from "../context/FileManagerContext";
import CodeEditor from "./component/CodeEditor";
import { userService } from "../../services";
import Communication from "./component/Communiaction";

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
    <div className="bg-[#120d0a] h-fit p-2">
      <div
        className="
  flex items-center justify-between 
  px-6 py-4
  rounded-xl
  bg-gradient-to-r from-[#1a120c]/90 via-[#140f0b]/90 to-[#1a120c]/90
  backdrop-blur-xl
  border border-amber-900/30
  shadow-lg shadow-black/40
"
      >
        {/* LEFT */}
        <button
          onClick={() => router.push("/")}
          className="
      flex items-center gap-2
      px-4 py-2
      rounded-lg
      bg-white/10
      text-amber-100
      text-sm font-medium
      hover:bg-white/20
      hover:shadow-md hover:shadow-amber-500/10
      transition-all
    "
        >
          <span className="text-lg">←</span>
          HOME
        </button>

        {/* CENTER */}
        <div className="text-center">
          <div className="text-amber-100 text-lg font-semibold tracking-wide">
            DevCollab
          </div>
          <div className="text-amber-400/70 text-xs tracking-wider uppercase">
            Collaboration Workspace
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3">
          <div
            className="
      w-9 h-9 rounded-full
      bg-gradient-to-br from-amber-500/30 to-amber-700/30
      flex items-center justify-center
      text-amber-100 font-semibold
      ring-1 ring-amber-500/40
    "
          >
            {userData.firstname?.[0]}
          </div>
          <div className="text-amber-100 text-sm">
            Welcome,&nbsp;
            <span className="font-semibold">{userData.firstname}</span>
          </div>
        </div>
      </div>

      <ProjectInfo projectData={projectData} />
      <FileManagerProvider projectData={projectData}>
        <FileManager projectData={projectData} />
        <CodeEditor userId={userData.id} userName={userData.username} />
        <Communication
          projectId={projectData.id}
          userId={userData.id}
          userName={userData.username}
        />
      </FileManagerProvider>
    </div>
  );
};

export default UserProfile;
