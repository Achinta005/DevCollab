import { apiCall } from "./baseApi";

export const projectService = {
  //API CALL FOR GETTING OWN PROJECTS(In "View Your Projects") USING USER ID
  getUserProjects: async () => {
    const token = localStorage.getItem("devcollabtoken");
    return apiCall("/projects/my-projects", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  },

  //API CALL FOR FINDING PROJECT BASED ON PROJECT INVITE CODE
  linkProjects: async (inviteCode) => {
    const token = localStorage.getItem("devcollabtoken");
    return apiCall("/projects/link_projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ inviteCode }),
    });
  },

  //API CALL FOR JOINING A PROJECT USING INVITE CODE
  joinProject: async (inviteCode) => {
    const token = localStorage.getItem("devcollabtoken");
    return apiCall("/projects/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ inviteCode }),
    });
  },

  //API CALL FOR CREATING NEW PROJECT
  createProject: async (payload, token) => {
    return apiCall("/projects/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  },

  //API CALL FOR FETCHING PROJECT METADATA USING PROJECT ID
  getProject: async (projectId) => {
    const token = localStorage.getItem("devcollabtoken");
    return apiCall("/projects/get-project", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ projectID: projectId }),
    });
  },

  //API CALL FOR UPDATING ROLE
  updateCollaboratorRole: async (projectId, collaboratorId, newRole) => {
    const token = localStorage.getItem("devcollabtoken");
    return apiCall("/projects/update-collaborator-role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ projectId, collaboratorId, newRole }),
    });
  },

  //API CALL FOR REMOVING COLLABORATOR
  removeCollaborator: async (projectId, collaboratorId) => {
    const token = localStorage.getItem("devcollabtoken");
    return apiCall("/projects/remove-collaborator", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ projectId, collaboratorId }),
    });
  },

  //API CALL FOR ADDING COLLABORATOR
  addCollaborator: async (projectId, email, role = "editor") => {
    const token = localStorage.getItem("devcollabtoken");
    return apiCall("/projects/add-collaborator", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ projectId, email, role }),
    });
  },

  //API CALL FOR UPDAING PROJECT METADATA
  updateProject: async (formData) => {
    const token = localStorage.getItem("devcollabtoken");

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/projects/update-project`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(formData),
      },
    );

    const text = await response.text();

    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(data?.message || "Update project failed");
    }

    return data;
  },

  //API CALL FOR DELETING PROJECT
  deleteProject: async (projectId, token) => {
    return apiCall(`/projects/delete-project/${projectId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  },
};
