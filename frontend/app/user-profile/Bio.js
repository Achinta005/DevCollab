"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import { getUserFromToken, setAuthToken } from "../lib/auth";
import { useRouter } from "next/navigation";
import { SquarePen, Check, X, Loader2 } from "lucide-react";
import Profile_Settings from "./prfofile-setting";
import Link from "next/link";
import { userService } from "../../services/userServices";

const Bio = () => {
  const [user, setUser] = useState(null);
  const [image, setImage] = useState(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [img, setImg] = useState("");
  const [showCropper, setShowCropper] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const router = useRouter();
  const fileInputRef = useRef(null);

  // Authentication check
  useEffect(() => {
    try {
      const userData = getUserFromToken();
      if (userData) {
        setUser(userData);
      } else {
        router.push("/Login");
      }
    } catch (err) {
      console.error("Authentication error:", err);
      router.push("/Login");
    }
  }, [router]);

  // Fetch profile image when user is loaded
  useEffect(() => {
    if (user?.username) {
      getImage();
    }
  }, [user?.username]);

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleImageChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    setError(null);
    const reader = new FileReader();

    reader.onload = () => {
      setImage(reader.result);
      setShowCropper(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    };

    reader.onerror = () => {
      setError("Failed to read the image file");
    };

    reader.readAsDataURL(file);
  }, []);

  const handleCropperClose = useCallback(() => {
    setShowCropper(false);
    setImage(null);
    setCroppedAreaPixels(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const getCroppedImage = useCallback(async () => {
    if (!image || !croppedAreaPixels) {
      setError("Invalid image or crop area");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const croppedImage = await cropImage(image, croppedAreaPixels);
      await uploadImage(croppedImage);

      window.location.reload();

      setShowCropper(false);
      setImage(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Error processing image:", err);
      setError("Failed to process the image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, [image, croppedAreaPixels]);

  const uploadImage = async (file) => {
    if (!user?.username) throw new Error("User not authenticated");

    const formData = new FormData();
    formData.append("username", user.username);
    formData.append("profilePic", file, file.name || "profile.jpg");

    try {
      const data = await userService.uploadImage(formData);
      setImg(data.imageUrl);
    } catch (err) {
      console.error("Error uploading image:", err);
    }
  };

  const getImage = async () => {
    if (!user?.username) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = userService.getImage(user.username);
      const data = await res;

      if (data.avatar) {
        setImg(data.avatar);
      } else {
        setImage(
          "https://res.cloudinary.com/dc1fkirb4/image/upload/v1756140468/cropped_circle_image_dhaq8x.png"
        );
      }
    } catch (err) {
      console.error("Failed to fetch profile picture:", err);
      setError("Failed to load profile picture");
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-black/90 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-50" />
      </div>
    );
  }

  return (
    <div className="bg-black/90 min-h-screen">
      <div className="container mx-auto px-4 py-4">
        <div className="flex gap-20">
          <Link href={"/"}>
            <div className="text-amber-50 bg-white/10 backdrop-blur-3xl p-3 rounded-lg m-3 hover:bg-white/20">
              <span className="mr-1"> &larr; Home</span>
            </div>
          </Link>
          <h1 className="text-amber-50 text-2xl font-semibold mb-6 whitespace-break-spaces">
            Hi {user.username}
          </h1>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
          <div className="p-6 text-amber-50 bg-gray-900/50 rounded-lg">
            <div className="flex flex-col items-center">
              <div className="relative">
                {isLoading ? (
                  <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : img ? (
                  <img
                    src={img}
                    alt="Profile"
                    className="w-64 h-64 rounded-full object-cover border-4 border-amber-500/30"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center text-sm text-center p-4">
                    No profile picture
                  </div>
                )}

                <label className="absolute -bottom-2 -right-2 cursor-pointer bg-amber-500 rounded-full p-2 hover:bg-amber-600 transition-colors shadow-lg">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <SquarePen size={16} className="text-black" />
                </label>
              </div>

              <p className="text-center mt-4 text-amber-200">
                Click the edit icon to change your profile picture
              </p>
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-lg min-h-[400px] p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Profile Information
            </h2>
            <Profile_Settings username={user.username} />
          </div>
        </div>

        {showCropper && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="relative w-full max-w-md h-96 bg-gray-900 rounded-xl shadow-2xl">
              <div className="absolute top-3 right-3 z-10">
                <button
                  onClick={handleCropperClose}
                  className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full transition-colors"
                  disabled={isUploading}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="w-full h-full rounded-xl overflow-hidden">
                <Cropper
                  image={image}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-gray-800/90 rounded-lg px-4 py-2">
                <div className="flex items-center space-x-2">
                  <span className="text-white text-sm">Zoom:</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-20"
                    disabled={isUploading}
                  />
                </div>

                <button
                  onClick={getCroppedImage}
                  disabled={isUploading || !croppedAreaPixels}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-2 rounded-full transition-colors flex items-center space-x-1"
                >
                  {isUploading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  {isUploading && <span className="text-xs">Saving...</span>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Bio;

// Helper functions
function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

async function cropImage(imageSrc, crop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Unable to get canvas context");

  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = crop.width * pixelRatio;
  canvas.height = crop.height * pixelRatio;

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blob from canvas"));
      },
      "image/jpeg",
      0.9
    );
  });
}
