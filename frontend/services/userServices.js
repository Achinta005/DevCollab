import { apiCall } from "./baseApi";

export const userService = {
  getProfile: async () => {
    return apiCall('/api/users/profile');
  },

  updateProfile: async (userData) => {
    return apiCall('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },
};