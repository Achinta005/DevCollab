import { apiCall } from "./baseApi";

export const userService = {
  //API CALL FOR FETCHING USER DATA
  getProfile: async (username) => {
    return apiCall(`/api/image/user/profile/${username}`,{
    });
  },

  //API CALL FOR UPDATING USER DATA
  updateProfile: async (formData) => {
    return apiCall("/api/image/user/profile", {
      method: "PUT",
      body: JSON.stringify(formData),
    });
  },

  //API CALL FOR GETTING PROFILE PICTURE USING USERNAME
  getImage: async (username) => {
    return apiCall("/api/get/profile-pic", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
  },

  //API FOR UPLOADING IMAGE USING USERNAME
  uploadImage: async (formData) => {
    return apiCall("/api/image/upload", {
      method: "POST",
      body: formData,
    });
  },
};
