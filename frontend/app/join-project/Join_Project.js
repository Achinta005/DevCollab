"use client";

import React, { useState, useEffect } from "react";
import { Label } from '../../components/ui/label'
import { cn } from '../lib/util'
import { Input } from '../../components/ui/input'
import { getAuthToken } from "../lib/auth";
import { SquarePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { projectService } from "../../services/projectService";

const Join_Project = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({ inviteCode: "" });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState({});
  const [token, setToken] = useState(null);
  const [joinMsg, setjoinMsg] = useState(null);

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
      const response = projectService.linkProjects(formData.inviteCode);
      const data = await response;

      setProject(data.data);
    } catch (err) {
      setError("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleProjSubmit = (inviteCode) => {
    const joinProj = async () => {
      try {
        const response = projectService.joinProject(inviteCode)
        const data = await response;

        setjoinMsg(data.message);

      } catch (err) {
        console.error("Error joining project:", err);
      }
    };
    joinProj();
  };

  return (
    <div className="relative min-h-screen">
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-sm w-full"
        style={{
          backgroundImage:
            "url('https://res.cloudinary.com/dc1fkirb4/image/upload/v1756225892/blue-futuristic-networking-technology_53876-97395_qfkikg.avif')",
        }}
      ></div>
      <div className="relative z-10">
        <div
          className="bg-white/10 backdrop-blur-3xl rounded-lg p-2 text-amber-50 w-fit relative top-5 left-5 active:scale-75 transition-transform duration-300 ease-in-out cursor-pointer"
          onClick={() => router.push("/")}
        >
          &larr;HOME
        </div>

        <form className="py-10 px-96" onSubmit={handleSubmit}>
          <div className="mb-2 flex flex-row space-y-0 space-x-2">
            <LabelInputContainer>
              <Label htmlFor="name" className="text-green-500 text-center text-lg">
                Project Link
              </Label>
              <Input
                id="inviteCode"
                name="inviteCode"
                type="text"
                value={formData.inviteCode}
                onChange={handleChange}
                placeholder="Enter Project Invite Link"
                required
                maxLength={10}
              />
            </LabelInputContainer>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm mb-4">
              {success}
            </div>
          )}

          <button
            className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-black to-neutral-600 font-medium text-white shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 dark:shadow-[0px_1px_0px_0px_#27272a_inset,0px_-1px_0px_0px_#27272a_inset] mb-3"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin mr-3 h-5 w-5 text-white"
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
              <span>Check Project</span>
            )}
            <BottomGradient />
          </button>
        </form>

        <div className="items-center flex justify-center">
          <div className="bg-white/10 backdrop-blur-3xl w-[50vw] h-[55vh] relative mt-10 rounded-2xl p-6 text-lg text-green-500 shadow-lg border border-white/20 mb-10">
            {project ? (
              <div className="flex flex-col items-center text-center space-y-4">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-teal-300 bg-clip-text text-transparent drop-shadow-md">
                  {project.name}
                </h1>
                <p className="text-lg text-gray-200 max-w-md leading-relaxed">{project.description}</p>

                <div className="flex flex-col items-center space-y-2">
                  <span className="text-xl text-gray-300">
                    Owner:
                    <span className="font-semibold text-green-400 ml-2">
                      {project.owner?.username || "Unknown"}
                    </span>
                  </span>

                  {project.owner?.avatar && (
                    <img
                      src={project.owner.avatar}
                      alt="Project Owner"
                      className="w-24 h-24 rounded-full border-2 border-green-400 shadow-lg hover:scale-105 transition-transform duration-300"
                    />
                  )}

                  {project.owner && (
                    <div
                      className="bg-white/30 p-2 rounded-lg active:scale-75 transition-transform duration-300 ease-in-out"
                      onClick={() => handleProjSubmit(project.inviteCode)}
                    >
                      <button className="text-white flex gap-3 cursor-pointer">
                        <SquarePlus /> JOIN
                      </button>
                    </div>
                  )}

                  {joinMsg && <p className="mt-3 text-green-400 font-semibold">{joinMsg}</p>}
                </div>
              </div>
            ) : (
              <p className="text-gray-300 text-center">Loading project details...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Join_Project;

const BottomGradient = () => {
  return (
    <>
      <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
      <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
    </>
  );
};

const LabelInputContainer = ({ children, className }) => {
  return <div className={cn("flex w-full flex-col space-y-2", className)}>{children}</div>;
};
