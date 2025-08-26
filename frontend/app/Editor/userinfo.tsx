"use client";
import React, { useState, useEffect } from "react";
import { getUserFromToken, TokenPayload } from "../lib/auth";
import { useRouter } from "next/navigation";

const UserProfile: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<TokenPayload | null>(null);
  const router = useRouter()

  useEffect(() => {
    const userData = getUserFromToken();
    if (userData) {
      setUser(userData);
      setMounted(true);
    } else {
      router.push("/Login")
    }
  }, [router]);

  if (!mounted) return null;

  if (!user) return <p>No user data available</p>;

  return (
    <div className="bg-black/90 min-h-screen">
      <button className="bg-white/10 backdrop-blur-3xl text-amber-50 cursor-pointer p-2 m-5 rounded-lg" onClick={() => router.push('/')}>&larr;HOME</button>
      <div className="p-4 m-4 border rounded-lg shadow-md bg-black/10 text-amber-50">
        <h2 className="text-xl font-bold mb-2">
          HELLO {user.username}
        </h2>
        <p>Email: {user.Email}</p>

      </div>
    </div>
  );
};

export default UserProfile;
