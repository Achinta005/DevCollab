"use client";

import React, { useState, useEffect } from "react";
import { Label } from '../../components/ui/label'
import { cn } from '../lib/util'
import { Input } from '../../components/ui/input'
import { userService } from "../../services/userServices";

const Profile_Setting = ({ username }) => {
  const [success, setSuccess] = useState("");
  const [isChanged, setIsChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    username: username,
    firstname: "",
    lastname: "",
    email: "",
    bio: "",
    skills: "",
    experience: "",
    github: "",
    portfolio: "",
    linkedin: "",
  });
  const [initialData, setInitialData] = useState(formData);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);
        const userData = await userService.getProfile(username);

        const loadedData = {
          firstname: userData.user.firstname || "",
          username: userData.user.username || "",
          lastname: userData.user.lastname || "",
          email: userData.user.email || "",
          bio: userData.user.profile?.bio || "",
          skills: userData.user.profile?.skills || "",
          experience: userData.user.profile?.experience || "",
          github: userData.user.profile?.github || "",
          portfolio: userData.user.profile?.portfolio || "",
          linkedin: userData.user.profile?.linkedin || "",
        };

        setFormData(loadedData);
        setInitialData(loadedData);
      } catch (err) {
        console.error("Failed to load user data", err);
        setError("Failed to load user data");
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      loadUserData();
    }
  }, [username]);

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

  const handleSubmit = (e) => {
    e.preventDefault();

    const updateProfile = async () => {
      try {
        const data = await userService.updateProfile(formData);
        if (!data.success) {
          console.error("Update failed:", data.message);
        } else {
          setSuccess("Profile updated successfully!");
        }
      } catch (err) {
        console.error("API call error:", err);
      }
    };

    updateProfile();
    window.location.reload();
  };

  return (
    <div>
      <form className="my-6" onSubmit={handleSubmit}>
        <div className="mb-4 flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2">
          <LabelInputContainer>
            <Label htmlFor="firstname" className="text-md text-green-500">First name</Label>
            <Input
              id="firstname"
              name="firstname"
              type="text"
              value={formData.firstname}
              onChange={handleChange}
              required
            />
          </LabelInputContainer>
          <LabelInputContainer>
            <Label htmlFor="lastname"className="text-md text-green-500">Last name</Label>
            <Input
              id="lastname"
              name="lastname"
              type="text"
              value={formData.lastname}
              onChange={handleChange}
            />
          </LabelInputContainer>
        </div>

        <LabelInputContainer className="mb-4">
          <Label htmlFor="email"className="text-md text-green-500">Email Address</Label>
          <Input
            id="email"
            name="email"
            placeholder="devcollab@email.com"
            type="email"
            value={formData.email}
            onChange={handleChange}
          />
        </LabelInputContainer>

        <LabelInputContainer className="mb-4">
          <Label htmlFor="bio"className="text-md text-green-500">BIO</Label>
          <Input
            id="bio"
            name="bio"
            placeholder="Enter profile Description"
            type="text"
            value={formData.bio}
            onChange={handleChange}
          />
        </LabelInputContainer>

        <LabelInputContainer className="mb-4">
          <Label htmlFor="skills"className="text-md text-green-500">SKILLS</Label>
          <Input
            id="skills"
            name="skills"
            placeholder="Enter Your Skills"
            type="text"
            value={formData.skills}
            onChange={handleChange}
          />
        </LabelInputContainer>

        <LabelInputContainer className="mb-4">
          <Label htmlFor="experience"className="text-md text-green-500">EXPERIENCE</Label>
          <Input
            id="experience"
            name="experience"
            placeholder="Enter your Experiences"
            type="text"
            value={formData.experience}
            onChange={handleChange}
          />
        </LabelInputContainer>

        <LabelInputContainer className="mb-4">
          <Label htmlFor="github"className="text-md text-green-500">GITHUB</Label>
          <Input
            id="github"
            name="github"
            placeholder="Enter your Github Profile"
            type="url"
            value={formData.github}
            onChange={handleChange}
          />
        </LabelInputContainer>

        <LabelInputContainer className="mb-4">
          <Label htmlFor="linkedin"className="text-md text-green-500">LINKEDIN</Label>
          <Input
            id="linkedin"
            name="linkedin"
            placeholder="Enter your Linkedin Profile"
            type="url"
            value={formData.linkedin}
            onChange={handleChange}
          />
        </LabelInputContainer>

        <LabelInputContainer className="mb-4">
          <Label htmlFor="portfolio"className="text-md text-green-500">PORTFOLIO</Label>
          <Input
            id="portfolio"
            name="portfolio"
            placeholder="Enter your Portfolio URL"
            type="url"
            value={formData.portfolio}
            onChange={handleChange}
          />
        </LabelInputContainer>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
            {success}
          </div>
        )}

        {isChanged ? (
          <button
            className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-black to-neutral-600 font-medium text-white shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 dark:shadow-[0px_1px_0px_0px_#27272a_inset,0px_-1px_0px_0px_#27272a_inset] mb-3"
            type="submit"
            disabled={loading || !!success}
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
                Updating Profile...
              </span>
            ) : (
              <span>Update Profile &rarr;</span>
            )}
            <BottomGradient />
          </button>
        ) : (
          <div></div>
        )}
      </form>
    </div>
  );
};

export default Profile_Setting;

const BottomGradient = () => {
  return (
    <>
      <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
      <span className="absolute inset-x-10 -bottom-px mx-auto block h-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
    </>
  );
};

const LabelInputContainer = ({ children, className }) => {
  return <div className={cn("flex w-full flex-col space-y-2", className)}>{children}</div>;
};
