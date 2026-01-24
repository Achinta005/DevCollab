"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Label } from "../../components/ui/label";
import { cn } from "../lib/util";
import { Input } from "../../components/ui/input";
import { getAuthToken } from "../lib/auth";
import { projectService } from "../../services/projectService";

const Create_project = ({ onClose }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    visibility: "",
    allowedLanguages: ["javascript"],
    maxCollaborators: 2,
  });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const storedToken = getAuthToken();
    if (storedToken) setToken(storedToken);
    else setError("Authentication token not found. Please login again.");
  }, []);

  const createProject = async (token, formData) => {
    setLoading(true);
    setError("");
    setSuccess("");

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      settings: {
        visibility: formData.visibility,
        allowedLanguages: formData.allowedLanguages.filter(
          (lang) => lang.trim() !== ""
        ),
        maxCollaborators: parseInt(formData.maxCollaborators),
        filePermissions: {
          whoCanUpload: "all",
          whoCanDelete: "owner",
        },
      },
    };

    try {
      const response = await projectService.createProject(payload,token);

      if (response.success) {
        setSuccess("Project created successfully!");
        setTimeout(() => {
          setFormData({
            name: "",
            description: "",
            visibility: "private",
            allowedLanguages: ["javascript"],
            maxCollaborators: 10,
          });
          setSuccess("");
          onClose(); 
          
          const projectId = response.project?.id || response.data?.id;
          if (projectId) {
            const params = new URLSearchParams({ projectId });
            router.push(`/Editor?${params.toString()}`);
          }
        }, 2000);
        return response;
      } else {
        throw new Error(response.message || "Failed to create project");
      }
    } catch (error) {
      console.error("Error creating project:", error);
      setError(error.message || "Failed to create project. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createProject(token, formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (error) setError("");
  };

  return (
    <div className="bg-gray-800 rounded-2xl p-6">
      <h2 className="text-2xl font-bold text-white mb-4 text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
        Create a New Project
      </h2>
      <form onSubmit={handleSubmit}>
        {/* Project Name */}
        <LabelInputContainer>
          <Label htmlFor="name" className="text-green-400 text-center">
            Project Name
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter Project Name"
            required
            maxLength={50}
            className="bg-gray-700 text-white border-gray-600"
          />
        </LabelInputContainer>

        {/* Description */}
        <LabelInputContainer className="mb-4">
          <Label htmlFor="description" className="text-green-400 text-center">
            Description
          </Label>
          <Input
            id="description"
            name="description"
            placeholder="Enter Project Description"
            type="text"
            value={formData.description}
            onChange={handleChange}
            required
            maxLength={200}
            className="bg-gray-700 text-white border-gray-600"
          />
        </LabelInputContainer>

        {/* Visibility */}
        <LabelInputContainer className="mb-4">
          <Label htmlFor="visibility" className="text-green-400 text-center">
            Visibility
          </Label>
          <select
            id="visibility"
            name="visibility"
            value={formData.visibility}
            onChange={handleChange}
            className="border py-2 flex h-10 w-full rounded-md border-gray-600 bg-gray-700 text-white px-3 text-sm"
            required
          >
            <option value="">Select Project Visibility</option>
            <option value="public">
              Public (Others can join with invitation link)
            </option>
            <option value="private">
              Private (No one can join this project)
            </option>
          </select>
        </LabelInputContainer>

        {/* Allowed Languages */}
        <LabelInputContainer className="mb-4">
          <Label
            htmlFor="allowedLanguages"
            className="text-green-400 text-center"
          >
            Allowed Languages
          </Label>
          <div className="grid grid-cols-2 gap-2 px-2">
            {["javascript", "python", "java", "cpp", "html", "css"].map(
              (lang) => (
                <label
                  key={lang}
                  className="flex items-center gap-2 capitalize text-gray-300"
                >
                  <input
                    type="checkbox"
                    name="allowedLanguages"
                    value={lang}
                    checked={formData.allowedLanguages.includes(lang)}
                    onChange={(e) => {
                      const { checked, value } = e.target;
                      setFormData((prev) => ({
                        ...prev,
                        allowedLanguages: checked
                          ? [...prev.allowedLanguages, value]
                          : prev.allowedLanguages.filter((l) => l !== value),
                      }));
                      if (error) setError("");
                    }}
                  />
                  {lang}
                </label>
              )
            )}
          </div>
        </LabelInputContainer>

        {/* Max Collaborators */}
        <LabelInputContainer className="mb-4">
          <Label
            htmlFor="maxCollaborators"
            className="text-green-400 text-center"
          >
            Max Collaborators: {formData.maxCollaborators}
          </Label>
          <input
            id="maxCollaborators"
            name="maxCollaborators"
            type="range"
            min="2"
            max="10"
            value={formData.maxCollaborators}
            onChange={handleChange}
            className="w-full accent-green-500"
          />
        </LabelInputContainer>

        {error && (
          <div className="bg-red-600/20 border border-red-500 text-red-300 px-4 py-2 rounded-md text-sm mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-600/20 border border-green-500 text-green-300 px-4 py-2 rounded-md text-sm mb-4">
            {success}
          </div>
        )}

        <button
          className="group/btn w-full py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-medium transition-all duration-200"
          type="submit"
          disabled={loading}
        >
          {loading ? "Creating Project..." : "Create Project"}
          <BottomGradient />
        </button>
      </form>
    </div>
  );
};

export default Create_project;

const BottomGradient = () => (
  <>
    <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
    <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
  </>
);

const LabelInputContainer = ({ children, className }) => (
  <div className={cn("flex w-full flex-col space-y-2", className)}>
    {children}
  </div>
);
