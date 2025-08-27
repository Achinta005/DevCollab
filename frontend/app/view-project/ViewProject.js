"use client";
import React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const ViewProject = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  const fetchUserProjects = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/my-projects`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log("User projects:", data.data);
        return data.data; // Returns array of projects
      } else {
        throw new Error(data.message || "Failed to fetch projects");
      }
    } catch (error) {
      console.error("Error fetching user projects:", error);
      throw error;
    }
  };

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        const data = await fetchUserProjects();
        setProjects(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

const enterProject = (project) => {
  // Store complex data structures in sessionStorage
  sessionStorage.setItem('projectCollaborators', JSON.stringify(project.collaborators));
  sessionStorage.setItem('projectFiles', JSON.stringify(project.files));
  sessionStorage.setItem('ProjectSettings', JSON.stringify(project.settings));

  
  // Pass simple values via URL
  const params = new URLSearchParams({
    projectId: project._id,
    name: project.name,
    description: project.description,
    inviteCode: project.inviteCode,
    ownerName: project.owner.fullName,
    ownerId: project.owner._id,
    visibility: project.settings.visibility,
    allowedLanguages: project.settings.allowedLanguages.join(','),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });
  
  router.push(`/Editor?${params.toString()}`);
};

  if (loading) {
    return (
      <div className="bg-gray-700 min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-700 min-h-screen flex items-center justify-center">
        <div className="text-red-400 text-xl">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 min-h-screen p-6">
      <h1 className="text-white text-3xl font-bold mb-8 text-center">My Projects</h1>
      
      {projects.length === 0 ? (
        <div className="text-white text-xl text-center">No projects found</div>
      ) : (
        <div className="flex flex-wrap justify-center gap-6">
          {projects.map((project) => (
            <div 
              key={project._id} 
              className="w-[350px] h-[350px] bg-white/10 backdrop-blur-3xl rounded-3xl p-6 hover:scale-105 transition-transform duration-300 ease-in shadow-2xl"
            >
              <div className="text-white space-y-4">
                <h2 className="text-xl font-bold mb-2">
                  Project Name: {project.name}
                </h2>
                
                <p className="text-gray-300 text-sm">
                  Description: {project.description}
                </p>
                
                <div className="flex items-center space-x-3">
                  <img 
                    src={project.owner.profile.avatar} 
                    alt={project.owner.username}
                    className="w-8 h-8 rounded-full"
                  />
                  <div>
                    <p className="text-sm font-medium">Owner: {project.owner.fullName}</p>
                    <p className="text-xs text-gray-400">@{project.owner.username}</p>
                  </div>
                </div>
                
                <div className="text-sm text-gray-300">
                  <p>Collaborators: {project.collaborators.length}</p>
                  <p>Files: {project.files.length}</p>
                  <p>Visibility: {project.settings.visibility}</p>
                </div>
                
                <div className="text-xs text-gray-300">
                  Created: {new Date(project.createdAt).toLocaleDateString()}
                </div>
                
                <div className="text-xs text-gray-300 mb-4">
                  <div className="flex items-center gap-2">
                    <span>Invite Code: {project.inviteCode}</span>
                  </div>
                </div>

                <button
                  onClick={() => enterProject(project)}
                  className="w-full mt-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  Enter Project
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewProject;