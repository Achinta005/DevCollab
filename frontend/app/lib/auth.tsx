"use client";
import { jwtDecode } from "jwt-decode";

export interface TokenPayload {
  id: string;
  username: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Profile?: {
    avatar?: string;
    bio?: string;
    skills?: string;
    experience?: string;
    github?: string;
    portfolio?: string;
    linkedin?: string;
  };
  Preferences?: {
    theme?: string;
    notification?: Record<string, unknown>;
  };
  exp?: number;
}

export const setAuthToken = (token: string): void => {
  if (token?.split(".").length === 3) {
    localStorage.setItem("token", token);
  } else {
    console.warn("Attempted to store invalid token:", token);
  }
};

export const getAuthToken = (): string | null =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

export const removeAuthToken = (): void => {
  if (typeof window !== "undefined") localStorage.removeItem("token");
};

export const isAuthenticated = (): boolean => {
  const token = getAuthToken();
  if (!token) return false;
  try {
    const decoded = jwtDecode<TokenPayload>(token);
    return !(decoded.exp && decoded.exp * 1000 < Date.now());
  } catch {
    return false;
  }
};

export const getUserFromToken = (): TokenPayload | null => {
  const token = getAuthToken();
  if (token?.split(".").length === 3) {
    try {
      const decoded = jwtDecode<TokenPayload>(token);
      if (decoded.exp && decoded.exp * 1000 < Date.now()) return null;
      return decoded;
    } catch (err) {
      console.error("Error decoding token:", err);
    }
  }
  return null;
};
