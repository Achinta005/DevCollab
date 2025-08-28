import { apiCall } from "./baseApi";

export const authService = {
  //API CALL FOR USER REGISTRATION
  register: async (formData) => {
    return apiCall('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
  },

  //API CALL FOR USER LOGIN
  login: async (formData) => {
    return apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
  },
};