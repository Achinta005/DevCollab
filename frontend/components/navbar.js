'use client';
import React, { useEffect, useState, useRef } from 'react';
import { LogIn, LogOut, X, User, Settings, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getUserFromToken } from '../app/lib/auth';
import { useRouter } from 'next/navigation';
import { Power } from 'lucide-react';

const ProfileNavigationPopup = ({ isOpen, onClose, position = "bottom", onNavigate, onLogout }) => {
  const detailRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (detailRef.current && !detailRef.current.contains(event.target)) {
        const profileButton = event.target.closest('[data-profile-button]');
        if (!profileButton && isOpen) {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const navigationLinks = [
    {
      id: "profile",
      label: "Profile",
      path: "/user-profile",
      icon: <User size={18} />,
      description: "View and edit your profile",
      action: "navigate"
    },
    {
      id: "settings",
      label: "Settings",
      path: "/settings",
      icon: <Settings size={18} />,
      description: "Account and preferences",
      action: "navigate"
    },
    {
      id: "logout",
      label: "Logout",
      path: null,
      icon: <LogOut size={18} />,
      description: "Sign out of your account",
      action: "logout"
    }
  ];

  const getPositionStyles = () => {
    switch (position) {
      case "top":
        return { bottom: "100%", right: "0", marginBottom: "8px" };
      case "left":
        return { right: "100%", top: "50%", transform: "translateY(-50%) translateX(-8px)", marginRight: "8px" };
      case "right":
        return { left: "100%", top: "50%", transform: "translateY(-50%) translateX(8px)", marginLeft: "8px" };
      default:
        return { top: "100%", right: "0", marginTop: "8px" };
    }
  };

  const handleLinkClick = (link) => {
    if (link.action === "logout") {
      if (onLogout) onLogout();
    } else if (link.action === "navigate" && link.path) {
      if (onNavigate) onNavigate(link.path, link.id);
    }
    onClose();
  };

  const basePositionStyles = getPositionStyles();

  return (
    <div
      ref={detailRef}
      className="absolute bg-white/30 backdrop-blur-2xl rounded-xl shadow-2xl border-2 border-blue-500 p-4 min-w-72 max-w-80 z-50 transition-all duration-300"
      style={{
        ...basePositionStyles,
        opacity: isOpen ? 1 : 0,
        transform: `${basePositionStyles.transform || ''} translateX(${isOpen ? "0" : "20px"}) scale(${isOpen ? 1 : 0.95})`,
      }}
    >
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute -top-1 -right-1 w-8 h-8 hover:bg-white/20 rounded-full flex items-center justify-center text-red-600 hover:text-red-800 transition-colors shadow-sm z-10"
          aria-label="Close navigation menu"
        >
          <X size={12} />
        </button>

        <div className="text-center mb-4 pr-4">
          <h3 className="font-bold text-lg text-blue-600">Menu</h3>
        </div>

        <div className="space-y-2">
          {navigationLinks.map((link, index) => (
            <button
              key={link.id}
              onClick={() => handleLinkClick(link)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 text-left group border border-transparent cursor-pointer ${link.action === "logout" ? "hover:bg-red-50 hover:border-red-200" : "hover:bg-blue-50 hover:border-blue-200"}`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className={`transition-colors ${link.action === "logout" ? "text-red-500 group-hover:text-red-600" : "text-blue-500 group-hover:text-blue-600"}`}>
                {link.icon}
              </div>
              <div className="flex-1">
                <div className={`font-semibold transition-colors ${link.action === "logout" ? "text-gray-800 group-hover:text-red-600" : "text-gray-800 group-hover:text-blue-600"}`}>
                  {link.label}
                </div>
                <div className={`text-xs transition-colors ${link.action === "logout" ? "text-gray-500 group-hover:text-red-500" : "text-gray-500 group-hover:text-blue-500"}`}>
                  {link.description}
                </div>
              </div>
              <div className={`transition-colors ${link.action === "logout" ? "text-gray-400 group-hover:text-red-500" : "text-gray-400 group-hover:text-blue-500"}`}>
                <ChevronRight size={16} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const tokenData = getUserFromToken();
      if (tokenData) setUser(tokenData);
    } catch (err) {
      console.error("Authentication error:", err);
    }
  }, []);

  useEffect(() => {
    const loadUserData = async () => {
      if (!user || !user.username) return;
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/image/user/profile/${user.username}`);
        const data = await response.json();
        setUserData(data.user || data);
      } catch (error) {
        console.error("Failed to load user data", error);
      }
    };
    loadUserData();
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setUserData(null);
    router.push('/');
  };

  const handleLogoClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsProfileOpen(!isProfileOpen);
  };

  const handleNavigation = (path, linkId) => {
    router.push(path);
  };
 const handleBackendConnect = async () => {
  try {
    console.log('Attempting to connect to:', `${process.env.NEXT_PUBLIC_API_URL}/connect`);
    
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/connect`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    console.log('Response status:', res.status);
    console.log('Response headers:', Object.fromEntries(res.headers.entries()));

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}, statusText: ${res.statusText}`);
    }

    const data = await res.json();
    console.log('Backend connection successful:', data);
    
  } catch (error) {
    console.error('Failed to connect with Backend:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
};

  return (
    <div className="flex justify-end gap-6">
          <div className='relative top-6' onClick={handleBackendConnect}>
      <button className='text-amber-50 cursor-pointer'>
        <Power />
      </button>
    </div>
      {!user ? (
        <div className='flex gap-5 mr-5'>
          <Link href="/Register" className="flex gap-3 bg-white/40 p-2 mt-3 rounded-lg cursor-pointer active:scale-95 transition-transform ease-in-out">
            Sign Up
            <img src="/signup.png" alt="sign_up" width={20} height={20} />
          </Link>
          <Link href="/Login" className="flex gap-3 bg-white/40 p-2 mt-3 rounded-lg cursor-pointer active:scale-95 transition-transform ease-in-out">
            Sign In
            <LogIn />
          </Link>
        </div>
      ) : (
        <div className='mr-5'>
          <div className='flex gap-5'>
            <h1 className="text-amber-50 mt-4 bg-white/10 p-2 backdrop-blur-3xl rounded-lg">
              Welcome {userData && userData.username}
            </h1>
            <div className="relative" data-profile-button>
              <button className="h-12 w-12 mt-3 rounded-full overflow-hidden border-2 border-white cursor-pointer hover:scale-105 transition-transform duration-200" onClick={handleLogoClick}>
                <img src={userData?.profile?.avatar || "/default-avatar.png"} alt="profile logo" className="w-full h-full object-cover" />
              </button>
              <ProfileNavigationPopup
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                onNavigate={handleNavigation}
                onLogout={handleLogout}
                position="bottom"
              />
            </div>
          </div>         
        </div>
      )}
    </div>
  );
};

export default Navbar;
