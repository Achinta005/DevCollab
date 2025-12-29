"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { projectService } from "../../services/projectService";
import { getUserFromToken } from "../lib/auth";
import { userService } from "../../services";

const DEFAULT_AVATAR = "/default-avatar.png";
const SUCCESS_MESSAGE_TIMEOUT = 2000;
const ERROR_MESSAGE_TIMEOUT = 3000;

const ViewProject = ({ onClose = () => {} }) => {
  const [ownedProjects, setOwnedProjects] = useState([]);
  const [collaboratedProjects, setCollaboratedProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [deletingProjectId, setDeletingProjectId] = useState(null);
  const [activeTab, setActiveTab] = useState("owned"); // "owned" or "collaborated"
  const router = useRouter();

  const fetchUserProjects = async () => {
    if (!projectService.getUserProjects) {
      throw new Error("Project service is not available");
    }
    try {
      const response = await projectService.getUserProjects();
      if (response.success) {
        return response.data; // Returns { owned: [], collaborated: [] }
      } else {
        throw new Error(response.message || "Failed to fetch projects");
      }
    } catch (error) {
      console.error("Error fetching user projects:", error);
      throw error;
    }
  };

  const deleteProject = async (projectId) => {
    setDeletingProjectId(projectId);
    try {
      const response = await projectService.deleteProject(projectId);
      if (response.success) {
        // Remove from owned projects only
        setOwnedProjects((prev) => prev.filter((project) => project.id !== projectId));
        setSuccess("Project deleted successfully!");
        setTimeout(() => setSuccess(null), SUCCESS_MESSAGE_TIMEOUT);
      } else {
        throw new Error(response.message || "Failed to delete project");
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      setError(error.message || "Failed to delete project. Please try again.");
      setTimeout(() => setError(null), ERROR_MESSAGE_TIMEOUT);
    } finally {
      setDeletingProjectId(null);
    }
  };

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        const data = await fetchUserProjects();
        setOwnedProjects(data.owned || []);
        setCollaboratedProjects(data.collaborated || []);
      } catch (err) {
        setError(err.message);
        setOwnedProjects([]);
        setCollaboratedProjects([]);
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    try {
      const tokenData = getUserFromToken();
      if (tokenData) setUser(tokenData);
    } catch (err) {
      console.error("Authentication error:", err);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const loadUserData = async () => {
      if (!user || !user.username) return;
      try {
        const data = await userService.getProfile(user.username);
        if (!isCancelled && (data.user || typeof data === "object")) {
          setUserData(data.user || data);
        } else if (!isCancelled) {
          throw new Error("Invalid user data format");
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to load user data", error);
        }
      }
    };
    loadUserData();
    return () => {
      isCancelled = true;
    };
  }, [user]);

  const enterProject = (project) => {
    if (onClose) onClose();
    // Use 'id' instead of '_id' for NestJS/TypeORM
    const params = new URLSearchParams({ projectId: project.id });
    router.push(`/Editor?${params.toString()}`);
  };

  // Get current projects based on active tab
  const currentProjects = activeTab === "owned" ? ownedProjects : collaboratedProjects;

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-2xl p-6 text-center text-gray-300">
        Loading projects...
      </div>
    );
  }

  const ProjectCard = ({ project, isOwner }) => (
    <div
      key={project.id}
      className="relative bg-gray-700/50 rounded-lg p-4 flex items-center gap-4 transition-all duration-200 hover:bg-gray-600/50"
    >
      <img
        src={project.owner?.profile?.avatar || DEFAULT_AVATAR}
        alt={project.owner?.username || "Unknown"}
        className="w-10 h-10 rounded-full border-2 border-gray-500/50 object-cover"
        onError={(e) => {
          if (e.target.src !== DEFAULT_AVATAR) {
            e.target.src = DEFAULT_AVATAR;
          }
        }}
      />
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-white">{project.name}</h3>
        <p className="text-sm text-gray-300 line-clamp-2">
          {project.description || "No description provided"}
        </p>
        <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-2">
          <span>Owner: {project.owner?.username || "Unknown"}</span>
          <span>| Collaborators: {project.collaborators?.length || 0}</span>
          <span>| Visibility: {project.settings?.visibility || "Unknown"}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => enterProject(project)}
          className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-medium transition-all duration-200 whitespace-nowrap"
        >
          Enter Project
        </button>
        {isOwner && (
          <button
            onClick={() => deleteProject(project.id)}
            disabled={deletingProjectId === project.id}
            aria-label={`Delete project ${project.name}`}
            aria-busy={deletingProjectId === project.id}
            className={`p-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg transition-all duration-200 ${
              deletingProjectId === project.id ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-gray-800 rounded-2xl p-6">
      <h2 className="text-2xl font-bold text-white mb-4 text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
        My Projects
      </h2>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("owned")}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            activeTab === "owned"
              ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
              : "bg-gray-700/50 text-gray-300 hover:bg-gray-600/50"
          }`}
        >
          Owned ({ownedProjects.length})
        </button>
        <button
          onClick={() => setActiveTab("collaborated")}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            activeTab === "collaborated"
              ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
              : "bg-gray-700/50 text-gray-300 hover:bg-gray-600/50"
          }`}
        >
          Collaborated ({collaboratedProjects.length})
        </button>
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-500 text-red-300 px-4 py-2 rounded-md text-sm mb-4 text-center">
          Error: {error}
        </div>
      )}
      {success && (
        <div className="bg-green-600/20 border border-green-500 text-green-300 px-4 py-2 rounded-md text-sm mb-4 text-center">
          {success}
        </div>
      )}

      {currentProjects.length === 0 ? (
        <div className="text-gray-300 text-center py-8">
          {activeTab === "owned"
            ? "No owned projects found"
            : "No collaborated projects found"}
        </div>
      ) : (
        <div className="grid gap-4 max-h-[60vh] overflow-y-auto">
          {currentProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isOwner={activeTab === "owned" || userData?.id === project.owner?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewProject;