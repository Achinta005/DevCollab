import { apiCall } from "./baseApi";

export const projectService = {
  //API CALL FOR GETTING OWN PROJECTS(In "View Your Projects") USING USER ID
  getUserProjects: async () => {
    return apiCall("/api/projects/my-projects");
  },

  linkProjects: async (inviteCode) => {
    return apiCall("/api/projects/link_projects", {
      method: "POST",
      body: JSON.stringify({ inviteCode }),
    });
  },
  
  joinProject: async (inviteCode) => {
    return apiCall("/api/projects/join", {
      method: "POST",
      body: JSON.stringify({ inviteCode }),
    });
  },

  //API CALL FOR FETCHING PROJECT METADATA USING PROJECT ID
  getProject: async (projectId) => {
    return apiCall("/api/projects/get-project", {
      method: "POST",
      body: JSON.stringify({ projectID: projectId }),
    });
  },

  //API CALL FOR UPDATING ROLE
  updateCollaboratorRole: async (projectId, collaboratorId, newRole) => {
    return apiCall("/api/projects/update-collaborator-role", {
      method: "POST",
      body: JSON.stringify({ projectId, collaboratorId, newRole }),
    });
  },

  //API CALL FOR REMOVING COLLABORATOR
  removeCollaborator: async (projectId, collaboratorId) => {
    return apiCall("/api/projects/remove-collaborator", {
      method: "POST",
      body: JSON.stringify({ projectId, collaboratorId }),
    });
  },

  //API CALL FOR ADDING COLLABORATOR
  addCollaborator: async (projectId, email, role = "editor") => {
    return apiCall("/api/projects/add-collaborator", {
      method: "POST",
      body: JSON.stringify({ projectId, email, role }),
    });
  },

  //API CALL FOR UPDAING PROJECT METADATA
  updateProject: async (formData) => {
    return apiCall("/api/projects/update-project", {
      method: "PUT",
      body: JSON.stringify(formData),
    });
  },
};
