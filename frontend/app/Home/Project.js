"use client";

import React, { useState } from "react";
import { Plus, SquarePlus, Eye } from "lucide-react";
import Create_project from "../create-project/Create_project";
import Join_Project from "../join-project/Join_Project";
import ViewProject from "../view-project/ViewProject";

const Project = () => {
  const [activeModal, setActiveModal] = useState(null);

  const openModal = (modal) => {
    setActiveModal(modal);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 md:p-8">
      {/* Cards */}
      <div className="flex flex-wrap justify-center gap-6 md:gap-8">
        {/* Create Project Card */}
        <div
          className="group relative w-72 h-72 bg-white/10 backdrop-blur-xl rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-2xl hover:bg-white/20 border border-white/20"
          onClick={() => openModal("create")}
          role="button"
          tabIndex={0}
          aria-label="Create a new project"
          onKeyPress={(e) => e.key === "Enter" && openModal("create")}
        >
          <Plus size={56} className="text-green-500 mb-4 group-hover:text-green-400 transition-colors" />
          <h2 className="text-2xl font-semibold text-white group-hover:text-green-300 transition-colors text-center">
            Create a New Project
          </h2>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>

        {/* Join Project Card */}
        <div
          className="group relative w-72 h-72 bg-white/10 backdrop-blur-xl rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-2xl hover:bg-white/20 border border-white/20"
          onClick={() => openModal("join")}
          role="button"
          tabIndex={0}
          aria-label="Join an existing project"
          onKeyPress={(e) => e.key === "Enter" && openModal("join")}
        >
          <SquarePlus size={56} className="text-green-500 mb-4 group-hover:text-green-400 transition-colors" />
          <h2 className="text-2xl font-semibold text-white group-hover:text-green-300 transition-colors text-center">
            Join an Existing Project
          </h2>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>

        {/* View Projects Card */}
        <div
          className="group relative w-72 h-72 bg-white/10 backdrop-blur-xl rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-2xl hover:bg-white/20 border border-white/20"
          onClick={() => openModal("view")}
          role="button"
          tabIndex={0}
          aria-label="View your projects"
          onKeyPress={(e) => e.key === "Enter" && openModal("view")}
        >
          <Eye size={56} className="text-green-500 mb-4 group-hover:text-green-400 transition-colors" />
          <h2 className="text-2xl font-semibold text-white group-hover:text-green-300 transition-colors text-center">
            View Your Projects
          </h2>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>
      </div>

      {/* Modal */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 transition-opacity duration-300">
          <div
            className="bg-gray-800 rounded-2xl p-6 w-full max-w-2xl mx-4 transform scale-95 animate-pop-up overflow-y-auto max-h-[80vh]"
            style={{ animation: "popUp 0.3s ease-out forwards" }}
          >
            {activeModal === "create" && <Create_project onClose={closeModal} />}
            {activeModal === "join" && <Join_Project onClose={closeModal} />}
            {activeModal === "view" && <ViewProject onClose={closeModal} />}
            <button
              onClick={closeModal}
              className="mt-4 w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus:ring-2 focus:ring-gray-500 focus:outline-none"
              aria-label="Close modal"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* CSS for Animation */}
      <style jsx>{`
        @keyframes popUp {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default Project;