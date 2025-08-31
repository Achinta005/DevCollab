"use client";

import React, { useState, useEffect } from "react";
import { Label } from "../../components/ui/label";
import { cn } from "../lib/util";
import { Input } from "../../components/ui/input";
import { getAuthToken } from "../lib/auth";
import { SquarePlus } from "lucide-react";
import { projectService } from "../../services/projectService";

const Join_Project = ({ onClose }) => {
  const [formData, setFormData] = useState({ inviteCode: "" });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState(null);
  const [token, setToken] = useState(null);
  const [joinMsg, setJoinMsg] = useState(null);

  useEffect(() => {
    const storedToken = getAuthToken();
    if (storedToken) {
      setToken(storedToken);
    } else {
      setError("Authentication token not found. Please login again.");
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await projectService.linkProjects(formData.inviteCode);
      setProject(response.data);
      setSuccess("Project found!");
    } catch (err) {
      setError("Invalid invite code or server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleProjSubmit = async (inviteCode) => {
    try {
      const response = await projectService.joinProject(inviteCode);
      setJoinMsg(response.message);
      setTimeout(() => {
        setJoinMsg("");
        onClose(); // Close modal after joining
      }, 2000);
    } catch (err) {
      setError("Error joining project. Please try again.");
      console.error("Error joining project:", err);
    }
  };

  return (
    <div className="bg-gray-800 rounded-2xl p-6">
      <h2 className="text-2xl font-bold text-white mb-4 text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
        Join an Existing Project
      </h2>
      <form onSubmit={handleSubmit}>
        <LabelInputContainer>
          <Label htmlFor="inviteCode" className="text-green-400 text-center">
            Project Invite Code
          </Label>
          <Input
            id="inviteCode"
            name="inviteCode"
            type="text"
            value={formData.inviteCode}
            onChange={handleChange}
            placeholder="Enter Project Invite Code"
            required
            maxLength={10}
            className="bg-gray-700 text-white border-gray-600"
          />
        </LabelInputContainer>

        {error && (
          <div className="bg-red-600/20 border border-red-500 text-red-300 px-4 py-2 rounded-md text-sm mt-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-600/20 border border-green-500 text-green-300 px-4 py-2 rounded-md text-sm mt-4">
            {success}
          </div>
        )}

        <button
          className="group/btn w-full py-2 mt-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-medium transition-all duration-200"
          type="submit"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin mr-2 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Checking Project...
            </span>
          ) : (
            "Check Project"
          )}
          <BottomGradient />
        </button>
      </form>

      {project && (
        <div className="mt-6 bg-gray-700/50 rounded-lg p-4 flex flex-col items-center text-center space-y-4">
          <h3 className="text-xl font-semibold text-white">{project.name}</h3>
          <p className="text-sm text-gray-300 max-w-md">{project.description}</p>
          <div className="flex flex-col items-center space-y-2">
            <span className="text-sm text-gray-300">
              Owner: <span className="font-medium text-green-400">{project.owner?.username || "Unknown"}</span>
            </span>
            {project.owner?.avatar && (
              <img
                src={project.owner.avatar}
                alt="Project Owner"
                className="w-16 h-16 rounded-full border-2 border-green-400 shadow-md hover:scale-105 transition-transform duration-300"
              />
            )}
            <button
              className="group/btn flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-medium transition-all duration-200"
              onClick={() => handleProjSubmit(project.inviteCode)}
            >
              <SquarePlus size={20} /> Join Project
              <BottomGradient />
            </button>
            {joinMsg && (
              <p className="mt-2 text-green-400 font-medium">{joinMsg}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Join_Project;

const BottomGradient = () => (
  <>
    <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
    <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
  </>
);

const LabelInputContainer = ({ children, className }) => (
  <div className={cn("flex w-full flex-col space-y-2", className)}>{children}</div>
);