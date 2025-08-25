"use client";
import React, { useState, useEffect } from "react";
import { getUserFromToken,TokenPayload } from "../lib/auth";

const UserProfile: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<TokenPayload | null>(null);

  useEffect(() => {
    setMounted(true); // Ensure client-side rendering
    setUser(getUserFromToken());
  }, []);

  if (!mounted) return null; // Avoid hydration mismatch

  if (!user) return <p>No user data available</p>;

  return (
    <div className="p-4 border rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-2">
       HELLO {user.username}
      </h2>
      <p>Email: {user.Email}</p>
      
    </div>
  );
};

export default UserProfile;
