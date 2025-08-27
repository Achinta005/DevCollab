"use client";
import React, { useState, useEffect } from "react";
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
} from "lucide-react";

const ProjectInfo = ({ projectData }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Set current user ID (you might get this from context or props)
    setCurrentUserId(projectData.owner?.id || projectData.ownerId);
  }, []);

  if (!projectData) return null;

  const collaborators = JSON.parse(
    sessionStorage.getItem("projectCollaborators") || "[]"
  );
  const files = JSON.parse(sessionStorage.getItem("projectFiles") || "[]");
  const settings = JSON.parse(
    sessionStorage.getItem("ProjectSettings") || "{}"
  );

  const getRoleIcon = (role) => {
    const icons = {
      owner: <Crown className="w-4 h-4" />,
      editor: <Edit className="w-4 h-4" />,
      viewer: <Eye className="w-4 h-4" />,
      commenter: <MessageSquare className="w-4 h-4" />,
    };
    return icons[role] || icons.viewer;
  };

  const getRoleColor = (role) => {
    const colors = {
      owner: "bg-purple-100 text-purple-800 border-purple-300",
      editor: "bg-blue-100 text-blue-800 border-blue-300",
      viewer: "bg-gray-100 text-gray-800 border-gray-300",
      commenter: "bg-green-100 text-green-800 border-green-300",
    };
    return colors[role] || colors.viewer;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

  const handleAddCollaborator = () => {
    if (newCollaboratorEmail.trim()) {
      // Here you would typically call an API to add the collaborator
      console.log("Adding collaborator:", newCollaboratorEmail.trim());
      setNewCollaboratorEmail("");
      setShowAddForm(false);
      // You might want to refresh the collaborators list after adding
    }
  };

  const handleRemoveCollaborator = (collaboratorId) => {
    console.log("Removing collaborator:", collaboratorId);
    // Handle removal logic here
  };

  const handleUpdateRole = (collaboratorId, newRole) => {
    console.log(
      "Updating role for collaborator:",
      collaboratorId,
      "to:",
      newRole
    );
    // Handle role update logic here
  };

  const canManageCollaborators = (userRole) => {
    return (
      userRole === "owner" ||
      (userRole === "editor" &&
        collaborators
          .find((c) => c.user._id === currentUserId)
          ?.permissions.includes("manage_collaborators"))
    );
  };

  const currentUserRole =
    collaborators.find((c) => c.user._id === currentUserId)?.role || "owner";

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(projectData.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500); // Reset after 1.5s
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Project Overview */}
      <div className="bg-gradient-to-r from-amber-900/20 to-amber-800/20 backdrop-blur-sm border border-amber-700/30 rounded-lg shadow-lg">
        <div className="p-6 text-amber-50">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-amber-600/20 rounded-lg border border-amber-500/30">
              <Code className="w-8 h-8 text-amber-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-amber-100">
                {projectData.name}
              </h1>
              <p className="text-amber-200/80">{projectData.description}</p>
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
                    {projectData.owner?.name || projectData.ownerName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span className="text-sm">
                    <strong>Invite Code:</strong>
                    <code className="ml-1 px-2 py-1 bg-amber-900/40 rounded text-amber-200 font-mono">
                      {projectData.inviteCode}
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
                    {formatDate(projectData.createdAt)}
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
                  <Users className="w-4 h-4 text-amber-400" />
                  <span className="text-sm">
                    <strong>Max Collaborators:</strong>{" "}
                    {settings.maxCollaborators || "Unlimited"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
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
      </div>

      {/* Collaborators Section */}
      <div className="bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 shadow-lg">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Collaborators
                </h2>
                <p className="text-sm text-gray-600">
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Collaborator
              </button>
            )}
          </div>

          {/* Add Collaborator Form */}
          {showAddForm && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
              <div className="flex gap-3">
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={newCollaboratorEmail}
                  onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddCollaborator();
                    }
                  }}
                />
                <button
                  onClick={handleAddCollaborator}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Send Invite
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Collaborators List */}
          <div className="space-y-4">
            {collaborators.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No collaborators yet</p>
                <p className="text-sm">
                  Add collaborators to start working together
                </p>
              </div>
            ) : (
              collaborators.map((collaborator) => (
                <div
                  key={collaborator._id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
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
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            collaborator.user.fullName
                          )}&background=6366f1&color=fff`;
                        }}
                      />
                      {collaborator.role === "owner" && (
                        <div className="absolute -top-1 -right-1 bg-purple-600 rounded-full p-1">
                          <Crown className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {collaborator.user.fullName}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(
                            collaborator.role
                          )}`}
                        >
                          {getRoleIcon(collaborator.role)}
                          {collaborator.role}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600">
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
                                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${getPermissionBadgeColor(
                                    permission
                                  )}`}
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
                            handleUpdateRole(collaborator._id, e.target.value)
                          }
                          className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="commenter">Commenter</option>
                          <option value="editor">Editor</option>
                        </select>

                        {/* Remove Button */}
                        <button
                          onClick={() =>
                            handleRemoveCollaborator(collaborator._id)
                          }
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove collaborator"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                  {/* Current User Indicator */}
                  {collaborator.user._id === currentUserId && (
                    <span className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-full">
                      You
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Permissions Legend */}
          {collaborators.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Permission Types:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded border ${getPermissionBadgeColor(
                      "read"
                    )}`}
                  >
                    read
                  </span>
                  <span>View project content</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded border ${getPermissionBadgeColor(
                      "write"
                    )}`}
                  >
                    write
                  </span>
                  <span>Edit project files</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded border ${getPermissionBadgeColor(
                      "delete"
                    )}`}
                  >
                    delete
                  </span>
                  <span>Delete files/content</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded border ${getPermissionBadgeColor(
                      "manage_collaborators"
                    )}`}
                  >
                    manage collaborators
                  </span>
                  <span>Add/remove users</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded border ${getPermissionBadgeColor(
                      "manage_settings"
                    )}`}
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
