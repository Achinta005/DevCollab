import React from "react";
import Navbar from "@/components/navbar";
import Project from "./Project";

const Homepage = () => {
  return (
    <div className="relative min-h-screen">
      {/* Blurred background */}
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-sm w-full"
        style={{
          backgroundImage:
            "url('https://res.cloudinary.com/dc1fkirb4/image/upload/v1756052854/premium_photo-1661964187664-e26f70e1a224_zaoacn.jpg')",
        }}
      ></div>

      {/* Navbar on top */}
      <div className="relative z-20">
        <Navbar />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center min-h-screen text-white px-4">
        <h1 className="py-8 text-5xl font-semibold">Welcome to DevCollab</h1>
        <p className="max-w-3xl py-4 text-lg">
          DevCollab is a comprehensive real-time developer collaboration
          platform that combines code editing, project management, and
          communication features. This tool is designed to help you make
          collaborative projects.
        </p>
        <div className="w-full mt-8">
          <Project />
        </div>
      </div>
    </div>
  );
};

export default Homepage;
