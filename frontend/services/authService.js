import { apiCall } from "./baseApi";

export const authService = {
  //API CALL FOR USER REGISTRATION
  register: async (formData) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      }
    );

    const data = await response.json();

    // Network-level / server crash
    if (!response.ok && data?.success !== false) {
      throw new Error(data.message || "Registration failed");
    }

    return data;
  },

  login: async (formData) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      }
    );

    const data = await response.json();

    // Throw only for real network / server failures
    if (!response.ok && data?.success !== false) {
      throw new Error(data.message || "Login failed");
    }

    return data;
  },
};
