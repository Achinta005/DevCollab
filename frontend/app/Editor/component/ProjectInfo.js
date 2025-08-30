"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  Crown,
  Edit,
  Eye,
  MessageSquare,
  Plus,
  X,
  Settings,
  Code,
  Calendar,
  Shield,
  Globe,
  Lock,
  Copy,
  Pencil,
  GitCommitHorizontal,
} from "lucide-react";
import { projectService } from "../../../services";

const ProjectInfo = ({ projectData }) => {
  //USESTATES
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState("");
  const [fetchProject, setFetchProject] = useState({});
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
  const [error, setError] = useState("");
  const [isChanged, setIsChanged] = useState(false);
  const [formData, setFormData] = useState({
    projectID: "",
    projectName: "",
    projectDesc: "",
    maxCollaborators: "",
    visibility: "",
  });
  const [initialData, setinitialData] = useState(formData);

  //KEEP TRACK WIDTH OF INPUT FIELD
  const [editName, setEditName] = useState(false);
  const [editDesc, setEditDesc] = useState(false);
  const [editmColl, setEditMColl] = useState(false);
  const [editVisibility, setEditVisibility] = useState(false);
  const [nameWidth, setNameWidth] = useState(0);
  const [descWidth, setDescWidth] = useState(0);
  const [MCollWidth, setMCollWidth] = useState(0);
  const nameSpanRef = useRef(null);
  const descSpanRef = useRef(null);
  const MCollSpanRef = useRef(null);
  useEffect(() => {
    if (nameSpanRef.current) {
      setNameWidth(nameSpanRef.current.offsetWidth + 10);
    }
  }, [fetchProject.name, editName]);

  useEffect(() => {
    if (descSpanRef.current) {
      setDescWidth(descSpanRef.current.offsetWidth + 10);
    }
  }, [fetchProject.projectDesc, editDesc]);

  useEffect(() => {
    if (MCollSpanRef.current) {
      setMCollWidth(MCollSpanRef.current.offsetWidth + 10);
    }
  }, [fetchProject.maxCollaborators, editmColl]);

  //FETCH PROJECT METADATA FROM DATABASE USING PROJECT ID
  const fetchProjectMetaData = async () => {
    try {
      const response = projectService.getProject(projectData.id);
      const data = await response;
      if (data.success) {
        return data.data;
      }
    } catch (error) {}
  };
  useEffect(() => {
    const loadProject = async () => {
      try {
        const data = await fetchProjectMetaData();
        setFetchProject(data);
      } catch (err) {
        setFetchProject(null);
      }
    };

    loadProject();
  }, []);

  //SETTING COMPLEX DATA INTO SEPARATE OBJECT
  const collaborators = fetchProject?.collaborators || [];
  const files = fetchProject?.files || [];
  const settings = fetchProject?.settings || "{}";

  //HANDLE SETTING THE INITIAL PROJECT METADATA
  useEffect(() => {
    if (fetchProject) {
      const loadData = {
        projectID: fetchProject._id || "",
        projectName: fetchProject.name || "",
        projectDesc: fetchProject.description || "",
        maxCollaborators: fetchProject.settings?.maxCollaborators || "",
        visibility: fetchProject.settings?.visibility || "",
      };
      setFormData(loadData);
      setinitialData(loadData);
    }
  }, [fetchProject]);

  //HANDLE CHANGES,EDITS IN THE INPUT FIELD OF PROJECT METADATA
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => {
      const updatedData = { ...prevData, [name]: value };
      const hasChanged = Object.keys(updatedData).some(
        (key) => updatedData[key] !== initialData[key]
      );
      setIsChanged(hasChanged);
      return updatedData;
    });
  };

  //HANDLE THE EDITING PROCESS OF PROJECT METADATA
  const handleSubmit = (e) => {
    e.preventDefault();

    const updatePrjectData = async () => {
      try {
        const response = projectService.updateProject(formData);

        const data = await response;
        if (!data.success) {
          console.error("Update failed:", data.message);
        } else {
          setSuccess("Projaect updated successfully!");
        }
      } catch (err) {
        console.error("API call error:", err);
      }
    };

    updatePrjectData();
    window.location.reload();
  };

  // APPLY ICON BASED ON ROLE
  const getRoleIcon = (role) => {
    const icons = {
      owner: <Crown className="w-4 h-4" />,
      editor: <Edit className="w-4 h-4" />,
      viewer: <Eye className="w-4 h-4" />,
      commenter: <MessageSquare className="w-4 h-4" />,
    };
    return icons[role] || icons.viewer;
  };

  //APPLY BORDER,BACKGROUND,TEXT-COLOR BASED ON ROLE
  const getRoleColor = (role) => {
    const colors = {
      owner: "bg-purple-100 text-purple-800 border-purple-300",
      editor: "bg-blue-100 text-blue-800 border-blue-300",
      viewer: "bg-gray-100 text-gray-800 border-gray-300",
      commenter: "bg-green-100 text-green-800 border-green-300",
    };
    return colors[role] || colors.viewer;
  };

  //APPLY BORDER,BACKGROUND,TEXT-COLOR BASED ON PERMISSION
  const getPermissionBadgeColor = (permission) => {
    const colors = {
      read: "bg-green-50 text-green-700 border-green-200",
      write: "bg-blue-50 text-blue-700 border-blue-200",
      delete: "bg-red-50 text-red-700 border-red-200",
      manage_collaborators: "bg-yellow-50 text-yellow-700 border-yellow-200",
      manage_settings: "bg-purple-50 text-purple-700 border-purple-200",
    };
    return colors[permission] || "bg-gray-50 text-gray-700 border-gray-200";
  };

  //CONVERT THE DATE-TIME TO UI FRIENDLY
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  //HANDELLING ADDING COLLABORATOR USING EMAIL
  const handleAddCollaboratorAdvanced = async () => {
    try {
      // Validation
      if (!newCollaboratorEmail.trim()) {
        setError("Please enter an email address");
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newCollaboratorEmail)) {
        setError("Please enter a valid email address");
        return;
      }

      // Clear previous errors
      setError("");
      setIsAddingCollaborator(true);

      const response = projectService.addCollaborator(
        projectData.id,
        newCollaboratorEmail.trim(),
        "editor"
      );

      const data = await response;

      if (data.success) {
        if (data.data.collaborator) {
          // If user already exists and was added immediately
          setFetchProject((prevProject) => ({
            ...prevProject,
            collaborators: [
              ...prevProject.collaborators,
              data.data.collaborator,
            ],
          }));
        }
        // Success handling
        setNewCollaboratorEmail("");
        setShowAddForm(false);
        setSuccess(data.message || "Invitation sent successfully!");

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(""), 3000);
      } else {
        throw new Error(data.message || "Failed to add collaborator");
      }
    } catch (error) {
      console.error("Error adding collaborator:", error);
      setError(error.message || "Failed to send invitation");
    } finally {
      setIsAddingCollaborator(false);
    }
  };

  //HANDELLING REMOVING COLLABORATOR
  const handleRemoveCollaboratorOptimistic = async (collaboratorId) => {
    // Store original collaborators for rollback
    const originalCollaborators = fetchProject.collaborators;

    try {
      const isConfirmed = window.confirm(
        "Are you sure you want to remove this collaborator?"
      );
      if (!isConfirmed) return;

      // Optimistic update - remove from UI immediately
      setFetchProject((prevProject) => ({
        ...prevProject,
        collaborators: prevProject.collaborators.filter(
          (collab) => collab._id !== collaboratorId
        ),
      }));

      const response = projectService.removeCollaborator(
        projectData.id,
        collaboratorId
      );
      const data = await response;
    } catch (error) {
      console.error("Error removing collaborator:", error);

      // Rollback optimistic update
      setFetchProject((prevProject) => ({
        ...prevProject,
        collaborators: originalCollaborators,
      }));

      alert(error.message || "Failed to remove collaborator");
    }
  };

  //HANDELLING UPDATING ROLE OF COLLABORATOR
  const handleUpdateRoleWithOptimisticUpdate = async (
    collaboratorId,
    newRole
  ) => {
    const originalCollaborator = fetchProject.collaborators.find(
      (c) => c._id === collaboratorId
    );
    const originalRole = originalCollaborator?.role;

    try {
      // Optimistic update - update UI immediately
      setFetchProject((prevProject) => ({
        ...prevProject,
        collaborators: prevProject.collaborators.map((collab) =>
          collab._id === collaboratorId ? { ...collab, role: newRole } : collab
        ),
      }));
      const response = projectService.updateCollaboratorRole(
        projectData.id,
        collaboratorId,
        newRole
      );
      const data = await response;
      if (!data.success) {
        throw new Error(data.message || "Failed to update role");
      }
      // Update with actual permissions from server
      if (data.data?.permissions) {
        setFetchProject((prevProject) => ({
          ...prevProject,
          collaborators: prevProject.collaborators.map((collab) =>
            collab._id === collaboratorId
              ? { ...collab, permissions: data.data.permissions }
              : collab
          ),
        }));
      }
    } catch (error) {
      console.error("Error updating collaborator role:", error);
      // Rollback optimistic update
      if (originalRole) {
        setFetchProject((prevProject) => ({
          ...prevProject,
          collaborators: prevProject.collaborators.map((collab) =>
            collab._id === collaboratorId
              ? { ...collab, role: originalRole }
              : collab
          ),
        }));
      }
      alert(error.message || "Failed to update role");
    }
  };

  //CHEKS THE CURRENT USER CAN MANAGE THE COLLABORATOR ACTIONS OR NOT
  const canManageCollaborators = (userRole) => {
    return (
      userRole === "owner" ||
      (userRole === "editor" &&
        collaborators
          .find((c) => c.user._id === currentUserId)
          ?.permissions.includes("manage_collaborators"))
    );
  };

  //CHECKS THE CURRENT USER ID & USER ROLE
  const currentUserRole = collaborators.find(
    (c) => c.user._id === projectData.currentUserId
  )?.role;
  useEffect(() => {
    setCurrentUserId(projectData.currentUserId);
  }, []);

  //COPY THE PROJECT INVITE CODE IN CLIPBOARD
  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(fetchProject.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // useEffect(() => {
  //   console.log( console.log(fetchProject))
  // }, [fetchProject])

  return (
    <div className="p-6 space-y-6">
      {/* Project Overview */}
      <form onSubmit={handleSubmit}>
        <div className="bg-gradient-to-r from-amber-900/20 to-amber-800/20 backdrop-blur-sm border border-amber-700/30 rounded-lg shadow-lg">
          <div className="p-6 text-amber-50">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-amber-600/20 rounded-lg border border-amber-500/30">
                <Code className="w-8 h-8 text-amber-300" />
              </div>
              <div>
                <div className="flex gap-3 items-center">
                  {editName ? (
                    <div className="relative">
                      <span
                        ref={nameSpanRef}
                        className="absolute top-0 left-0 invisible whitespace-pre text-2xl font-bold"
                      >
                        {formData.projectName}
                      </span>

                      <input
                        type="text"
                        name="projectName"
                        value={formData.projectName}
                        onChange={handleChange}
                        style={{ width: `${nameWidth}px` }}
                        className="bg-transparent border-b-2 border-amber-400 text-2xl font-bold text-amber-100 focus:outline-none focus:border-amber-200"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <h1
                      className="text-2xl font-bold text-amber-100 cursor-pointer"
                      onClick={() => setEditName(true)}
                    >
                      {fetchProject.name}
                    </h1>
                  )}

                  {currentUserRole === "owner" && (
                    <Pencil
                      className="cursor-pointer"
                      onClick={() => setEditName((prev) => !prev)}
                      size={12}
                    />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {editDesc ? (
                    <div className="relative">
                      <span
                        ref={descSpanRef}
                        className="absolute top-0 left-0 invisible whitespace-pre text-amber-200/80"
                      >
                        {formData.projectDesc}
                      </span>

                      <input
                        type="text"
                        name="projectDesc"
                        value={formData.projectDesc}
                        onChange={handleChange}
                        style={{ width: `${descWidth}px` }}
                        className="bg-transparent border-b border-amber-400 text-amber-200/80 focus:outline-none focus:border-amber-200"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <p className="text-amber-200/80 cursor-pointer">
                      {fetchProject.description}
                    </p>
                  )}
                  {currentUserRole === "owner" && (
                    <Pencil
                      className="cursor-pointer"
                      onClick={() => setEditDesc((prev) => !prev)}
                      size={12}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-amber-200 border-b border-amber-700/50 pb-2">
                  Project Details
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span className="text-sm">
                      <strong>Owner:</strong>{" "}
                      {fetchProject.owner?.fullName || fetchProject.ownerName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="text-sm">
                      <strong>Invite Code:</strong>
                      <code className="ml-1 px-2 py-1 bg-amber-900/40 rounded text-amber-200 font-mono">
                        {fetchProject.inviteCode}
                      </code>
                    </span>
                    <button
                      onClick={copyInviteCode}
                      className="p-1 rounded hover:bg-amber-700/30 transition"
                      title="Copy invite code"
                    >
                      <Copy className="w-4 h-4 text-amber-300" />
                    </button>
                    {copied && (
                      <span className="text-xs text-emerald-400">Copied!</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span className="text-sm">
                      <strong>Created:</strong>{" "}
                      {formatDate(fetchProject.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-amber-200 border-b border-amber-700/50 pb-2">
                  Settings
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {editmColl ? (
                      <div className="relative">
                        {/* Hidden span for width calculation */}
                        <span
                          ref={MCollSpanRef}
                          className="absolute top-0 left-0 invisible whitespace-pre text-2xl font-bold"
                        >
                          {formData.maxCollaborators}
                        </span>

                        <input
                          type="number"
                          name="maxCollaborators"
                          value={formData.maxCollaborators}
                          onChange={handleChange}
                          style={{ width: `${MCollWidth}px` }}
                          className="bg-transparent border-b-2 border-amber-400 text-2xl font-bold text-amber-100 focus:outline-none focus:border-amber-200 
             [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none 
             [appearance:textfield]"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <>
                        <Users className="w-4 h-4 text-amber-400" />
                        <strong>Max Collaborators:</strong>{" "}
                        <span className="text-sm">
                          {fetchProject.settings?.maxCollaborators}
                        </span>
                      </>
                    )}

                    {currentUserRole === "owner" && (
                      <Pencil
                        className="cursor-pointer"
                        onClick={() => setEditMColl((prev) => !prev)}
                        size={12}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editVisibility ? (
                      <div className="relative">
                        <select
                          name="visibility"
                          value={fetchProject.settings?.visibility}
                          onChange={handleChange}
                          className="appearance-none bg-amber-900/40 border border-amber-400 text-amber-100 text-sm font-medium rounded-lg px-3 py-1 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer"
                          autoFocus
                          onBlur={() => setEditVisibility(false)}
                        >
                          <option
                            value="public"
                            className="bg-amber-800 text-green-300"
                          >
                            Public
                          </option>
                          <option
                            value="private"
                            className="bg-amber-800 text-red-300"
                          >
                            Private
                          </option>
                        </select>

                        {/* custom arrow icon */}
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-amber-300">
                          ▼
                        </span>
                      </div>
                    ) : (
                      <>
                        {settings.visibility === "public" ? (
                          <Globe className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-400" />
                        )}
                        <span className="text-sm">
                          <strong>Visibility:</strong>
                          <span
                            className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              settings.visibility === "public"
                                ? "bg-green-600/20 text-green-300 border border-green-500/30"
                                : "bg-red-600/20 text-red-300 border border-red-500/30"
                            }`}
                          >
                            {settings.visibility || "private"}
                          </span>
                        </span>
                      </>
                    )}
                    {currentUserRole === "owner" && (
                      <Pencil
                        className="cursor-pointer"
                        onClick={() => setEditVisibility((prev) => !prev)}
                        size={12}
                      />
                    )}
                  </div>
                  <div className="flex items-start gap-2">
                    <Code className="w-4 h-4 text-amber-400 mt-0.5" />
                    <div className="text-sm">
                      <strong>Languages:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(settings.allowedLanguages || ["javascript"]).map(
                          (lang, index) => (
                            <span
                              key={index}
                              className="px-2 py-0.5 bg-amber-800/40 text-amber-200 rounded text-xs border border-amber-600/30"
                            >
                              {lang}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-amber-200 border-b border-amber-700/50 pb-2">
                  Statistics
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span className="text-sm">
                      <strong>Collaborators:</strong> {collaborators.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-amber-400" />
                    <span className="text-sm">
                      <strong>Files:</strong> {files.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {isChanged ? (
            <button
              type="submit"
              className="absolute top-4 right-6 text-amber-400 bg-amber-800/40 border-amber-600/30 p-2 rounded-lg cursor-pointer active:scale-75 transition-transform duration-200 ease-in"
            >
              <div className="flex gap-1">
                <GitCommitHorizontal />
                UPDATE CHANGES
              </div>
            </button>
          ) : (
            <></>
          )}
        </div>
      </form>

      {/* Collaborators Section */}
      <div className="bg-gradient-to-r from-amber-900/20 to-amber-800/20 backdrop-blur-sm border border-amber-700/30 rounded-lg shadow-lg text-amber-400">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-700/20 rounded-lg">
                <Users className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font semigroup-bold">Collaborators</h2>
                <p className="text-sm">
                  {collaborators.length}{" "}
                  {collaborators.length === 1
                    ? "collaborator"
                    : "collaborators"}
                </p>
              </div>
            </div>

            {canManageCollaborators(currentUserRole) && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-400 text-amber-900 rounded-lg hover:bg-amber-500 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Collaborator
              </button>
            )}
          </div>

          {/* Add Collaborator Form */}
          {showAddForm && (
            <div className="bg-amber-700/20 rounded-lg p-4 mb-6 border border-amber-600/30">
              <div className="flex gap-3">
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={newCollaboratorEmail}
                  onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                  className="flex-1 px-3 py-2 border border-amber-600/30 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent text-amber-400 bg-amber-700/10"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddCollaboratorAdvanced();
                    }
                  }}
                  aria-label="Enter email address"
                  disabled={isAddingCollaborator}
                />
                <button
                  onClick={handleAddCollaboratorAdvanced}
                  disabled={isAddingCollaborator}
                  className="px-4 py-2 bg-amber-400 text-amber-900 rounded-lg hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAddingCollaborator ? "Sending..." : "Send Invite"}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-2 text-amber-400 hover:text-amber-300 transition-colors"
                  disabled={isAddingCollaborator}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="mt-3 text-red-400 text-sm">{error}</div>
              )}
              {success && (
                <div className="mt-3 text-green-400 text-sm">{success}</div>
              )}
            </div>
          )}

          {/* Collaborators List */}
          <div className="space-y-4">
            {collaborators.length === 0 ? (
              <div className="text-center py-8 text-amber-400">
                <Users className="w-12 h-12 mx-auto mb-3 text-amber-400/50" />
                <p>No collaborators yet</p>
                <p className="text-sm">
                  Add collaborators to start working together
                </p>
              </div>
            ) : (
              collaborators.map((collaborator) => (
                <div
                  key={collaborator._id}
                  className="flex items-center justify-between p-4 bg-amber-700/20 rounded-lg border border-amber-600/30 hover:bg-amber-700/30 transition-colors"
                >
                  {/* User Info */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="relative">
                      <img
                        src={
                          collaborator.user.profile?.avatar ||
                          "/default-avatar.png"
                        }
                        alt={`${collaborator.user.fullName}'s avatar`}
                        className="w-12 h-12 rounded-full object-cover border-2 border-amber-600/30"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            collaborator.user.fullName
                          )}&background=6366f1&color=fff`;
                        }}
                      />
                      {collaborator.role === "owner" && (
                        <div className="absolute -top-1 -right-1 bg-amber-400 rounded-full p-1">
                          <Crown className="w-3 h-3 text-amber-900" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-amber-400">
                          {collaborator.user.fullName}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border border-amber-400 text-amber-400`}
                        >
                          {getRoleIcon(collaborator.role)}
                          {collaborator.role}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-amber-400">
                        <span>@{collaborator.user.username}</span>
                        <span>Joined {formatDate(collaborator.joinedAt)}</span>
                      </div>

                      {/* Permissions */}
                      {collaborator.permissions &&
                        collaborator.permissions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {collaborator.permissions.map(
                              (permission, index) => (
                                <span
                                  key={index}
                                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium border border-amber-400 text-amber-400`}
                                >
                                  {permission.replace(/_/g, " ")}
                                </span>
                              )
                            )}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Actions */}
                  {canManageCollaborators(currentUserRole) &&
                    collaborator.role !== "owner" &&
                    collaborator.user._id !== currentUserId && (
                      <div className="flex items-center gap-2">
                        {/* Role Selector */}
                        <select
                          value={collaborator.role}
                          onChange={(e) =>
                            handleUpdateRoleWithOptimisticUpdate(
                              collaborator._id,
                              e.target.value
                            )
                          }
                          className="px-3 py-1 text-sm border border-amber-600/30 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent text-amber-400 bg-amber-700/10"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="commenter">Commenter</option>
                          <option value="editor">Editor</option>
                        </select>

                        {/* Remove Button */}
                        <button
                          onClick={() =>
                            handleRemoveCollaboratorOptimistic(collaborator._id)
                          }
                          className="p-2 text-amber-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="Remove collaborator"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                  {/* Current User Indicator */}
                  {collaborator.user._id === currentUserId && (
                    <span className="px-3 py-1 text-xs font-medium text-amber-900 bg-amber-400 border border-amber-600/30 rounded-full">
                      You
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Permissions Legend */}
          {collaborators.length > 0 && (
            <div className="mt-6 p-4 bg-amber-700/20 rounded-lg border border-amber-600/30">
              <h4 className="text-sm font-semibold text-amber-400 mb-2">
                Permission Types:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-amber-400">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded border border-amber-400 text-amber-400`}
                  >
                    read
                  </span>
                  <span>View project content</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded border border-amber-400 text-amber-400`}
                  >
                    write
                  </span>
                  <span>Edit project files</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded border border-amber-400 text-amber-400`}
                  >
                    delete
                  </span>
                  <span>Delete files/content</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded border border-amber-400 text-amber-400`}
                  >
                    manage collaborators
                  </span>
                  <span>Add/remove users</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded border border-amber-400 text-amber-400`}
                  >
                    manage settings
                  </span>
                  <span>Change project settings</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectInfo;
