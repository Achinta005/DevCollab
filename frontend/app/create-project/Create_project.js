"use client";

import React, { useState, useEffect } from "react";
import { cn } from "../lib/util";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "../lib/auth";
import { useRouter } from "next/navigation";

const Create_project = () => {
  const router = useRouter();
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

  const createProject = async (token, formData) => {
    setLoading(true);
    setError("");
    setSuccess("");

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      settings: {
        visibility: formData.visibility,
        allowedLanguages: formData.allowedLanguages.filter((lang) => lang.trim() !== ""),
        maxCollaborators: parseInt(formData.maxCollaborators),
      },
    };

    console.log("Sending payload:", payload);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || `HTTP error! status: ${response.status}`);

      console.log("Project Created Successfully:", data);
      setSuccess("Project created successfully!");

      // Reset form after successful creation
      setTimeout(() => {
        setFormData({
          name: "",
          description: "",
          visibility: "",
          allowedLanguages: ["javascript"],
          maxCollaborators: 2,
        });
        setSuccess("");
      }, 2000);

      return data;
    } catch (error) {
      console.error("Error creating project:", error);
      setError(error.message || "Failed to create project. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedToken = getAuthToken();
    if (storedToken) setToken(storedToken);
    else setError("Authentication token not found. Please login again.");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setError("No authentication token found");
      return;
    }
    if (!formData.name.trim()) {
      setError("Project name is required");
      return;
    }
    if (!formData.description.trim()) {
      setError("Project description is required");
      return;
    }
    if (!formData.visibility) {
      setError("Please select project visibility");
      return;
    }
    if (formData.allowedLanguages.length === 0) {
      setError("Please select at least one programming language");
      return;
    }

    await createProject(token, formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (error) setError("");
  };

  return (
    <div className="relative min-h-screen">
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-sm w-full"
        style={{
          backgroundImage:
            "url('https://res.cloudinary.com/dc1fkirb4/image/upload/v1756215458/pexels-codioful-6985003_tik2li.jpg')",
        }}
      ></div>
      <div
        className="bg-white/30 backdrop-blur-3xl rounded-lg p-2 text-amber-50 w-fit absolute left-5 top-5 active:scale-75 transition-transform duration-300 ease-in-out cursor-pointer"
        onClick={() => router.push("/")}
      >
        &larr;HOME
      </div>

      <div className="relative z-10 pt-24 mx-96">
        <form className="my-6" onSubmit={handleSubmit}>
          {/* Project Name */}
          <LabelInputContainer>
            <Label htmlFor="name" className="text-green-500 text-center text-md">
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
            />
          </LabelInputContainer>

          {/* Description */}
          <LabelInputContainer className="mb-2">
            <Label htmlFor="description" className="text-green-500 text-center text-md">
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
            />
          </LabelInputContainer>

          {/* Visibility */}
          <LabelInputContainer className="mb-2">
            <Label htmlFor="visibility" className="text-green-500 text-center text-md">
              Visibility
            </Label>
            <select
              id="visibility"
              name="visibility"
              value={formData.visibility}
              onChange={handleChange}
              className="border py-2 shadow-input flex h-10 w-full rounded-md border-none bg-gray-50 px-3 text-sm text-black"
              required
            >
              <option value="">Select Project Visibility</option>
              <option value="public">Public (Others can join with invitation link)</option>
              <option value="private">Private (No one can join this project)</option>
            </select>
          </LabelInputContainer>

          {/* Allowed Languages */}
          <LabelInputContainer className="mb-2">
            <Label htmlFor="allowedLanguages" className="text-green-500 text-center text-md">
              Allowed Languages
            </Label>
            <div className="grid grid-cols-2 px-2">
              {["javascript", "python", "java", "cpp", "html", "css"].map((lang) => (
                <label key={lang} className="flex items-center gap-2 capitalize text-white">
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
              ))}
            </div>
          </LabelInputContainer>

          {/* Max Collaborators */}
          <LabelInputContainer className="mb-4">
            <Label htmlFor="maxCollaborators" className="text-green-500 text-md text-center">
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
              className="w-full"
            />
          </LabelInputContainer>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm mb-4">{success}</div>}

          <button
            className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-black to-neutral-600 font-medium text-white mb-3"
            type="submit"
            disabled={loading}
          >
            {loading ? "Creating Project..." : "Create Project"}
            <BottomGradient />
          </button>
        </form>
      </div>
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
  <div className={cn("flex w-full flex-col space-y-2", className)}>{children}</div>
);
