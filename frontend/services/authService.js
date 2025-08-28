import { apiCall } from "./baseApi";

export const authService = {
  login: async (credentials) => {
    return apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  register: async (userData) => {
    return apiCall('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  logout: async () => {
    return apiCall('/api/auth/logout', {
      method: 'POST',
    });
  },
};