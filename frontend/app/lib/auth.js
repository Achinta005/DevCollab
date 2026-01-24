"use client";
import { jwtDecode } from "jwt-decode";

export const setAuthToken = (token) => {
  if (token?.split(".").length === 3) {
    localStorage.setItem("devcollabtoken", token);
  } else {
    console.warn("Attempted to store invalid token:", token);
  }
};

export const getAuthToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("devcollabtoken") : null;

export const removeAuthToken = () => {
  if (typeof window !== "undefined") localStorage.removeItem("devcollabtoken");
};

export const isAuthenticated = () => {
  const token = getAuthToken();
  if (!token) return false;
  try {
    const decoded = jwtDecode(token);
    return !(decoded.exp && decoded.exp * 1000 < Date.now());
  } catch {
    return false;
  }
};

export const getUserFromToken = () => {
  const token = getAuthToken();
  if (token?.split(".").length === 3) {
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp && decoded.exp * 1000 < Date.now()) return null;
      return decoded;
    } catch (err) {
      console.error("Error decoding token:", err);
    }
  }
  return null;
};
