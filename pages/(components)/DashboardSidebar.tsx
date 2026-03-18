"use client";

import { useEffect, useState } from "react";
import { BsFolder, BsHeart, BsCalendar, BsStars, BsTrash, BsChevronLeft, BsChevronRight } from "react-icons/bs";
import { FiLogOut, FiUser } from "react-icons/fi";
import { useUserStore } from "@/store/userStore";
import { useRouter } from "next/router";
import Cookies from "js-cookie";

export default function DashboardSidebar() {
  const { user, fetchUser, clearUser } = useUserStore();
  const router = useRouter();
  // Avoid SSR hydration mismatch: start uncollapsed, then hydrate from localStorage on client
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Fetch user on mount to ensure login state is current and hydrate collapse state
  useEffect(() => {
    fetchUser();
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved === "true") {
        setIsCollapsed(true);
      }
    }
    setHydrated(true);
  }, [fetchUser]);

  const userInitial = user?.firstName?.[0]?.toUpperCase() || "U";
  const userName = user?.firstName || "User";

  // Generate a consistent random color for the user's avatar based on their name
  const getAvatarColor = (name: string) => {
    const colors = [
      '#3B82F6', // blue
      '#10B981', // green
      '#F59E0B', // amber
      '#EF4444', // red
      '#8B5CF6', // purple
      '#EC4899', // pink
      '#06B6D4', // cyan
      '#F97316', // orange
    ];
    // Use the first letter to deterministically pick a color
    const index = (name.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  const avatarColor = getAvatarColor(userName);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-collapsed", String(newState));
    }
  };

  const handleLogout = () => {
    // Clear auth cookie (this is what middleware checks)
    Cookies.remove("authToken");

    // Clear user state from Zustand store
    clearUser();

    // Clear any persisted user storage
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("user-storage");
        localStorage.removeItem("auth-token");
      }
    } catch {
      // ignore storage errors
    }

    // Redirect to login page
    router.push("/auth/login");
  };

  // During SSR/hydration, render uncollapsed to match server HTML
  const collapsed = hydrated ? isCollapsed : false;

  return (
    <div className={`${collapsed ? 'w-16' : 'w-56'} bg-white/80 backdrop-blur-sm border-r border-gray-300/50 flex flex-col shadow-sm transition-all duration-300 relative z-50`}>
      {/* Collapse Toggle Button */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3 top-4 z-10 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <BsChevronRight className="w-3 h-3" /> : <BsChevronLeft className="w-3 h-3" />}
      </button>
      {/* Logo Section */}
      <div className={`p-6 mb-4 flex items-center ${collapsed ? 'justify-center px-1' : 'justify-start px-6'}`}>
        {!collapsed ? (
          <img 
            src="/assets/mainLogo.svg" 
            alt="Logo" 
            className="h-8 w-auto object-contain" 
          />
        ) : (
          <img 
            src="/assets/mainLogo.svg" 
            alt="Logo" 
            className="w-10 h-auto object-contain" 
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-2">
        <nav className="space-y-1">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              router.push("/dashboard");
            }}
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-sm rounded-lg transition-colors ${router.pathname === "/dashboard"
              ? "font-semibold text-blue-600 bg-blue-50 border border-blue-100"
              : "text-gray-600 hover:bg-gray-50"
              }`}
            title={isCollapsed ? "My Projects" : undefined}
          >
            <BsFolder className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>My Projects</span>}
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              router.push("/dashboard/favorites");
            }}
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-sm rounded-lg transition-colors ${router.pathname === "/dashboard/favorites"
              ? "font-semibold text-blue-600 bg-blue-50 border border-blue-100"
              : "text-gray-600 hover:bg-gray-50"
              }`}
            title={isCollapsed ? "Favorites" : undefined}
          >
            <BsHeart className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Favorites</span>}
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              router.push("/dashboard/templates");
            }}
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-sm hover:bg-gray-50 rounded-lg transition-colors ${router.pathname === "/dashboard/templates"
              ? "font-semibold text-blue-600 bg-blue-50 border border-blue-100"
              : "text-gray-600"
              }`}
            title={isCollapsed ? "Templates" : undefined}
          >
            <BsCalendar className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Templates</span>}
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              router.push("/dashboard/ai");
            }}
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-sm hover:bg-gray-50 rounded-lg transition-colors ${router.pathname === "/dashboard/ai"
              ? "font-semibold text-blue-600 bg-blue-50 border border-blue-100"
              : "text-gray-600"
              }`}
            title={isCollapsed ? "AI Assistant" : undefined}
          >
            <BsStars className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>AI Assistant</span>}
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              router.push("/dashboard/trash");
            }}
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-sm hover:bg-gray-50 rounded-lg transition-colors ${router.pathname === "/dashboard/trash"
              ? "font-semibold text-blue-600 bg-blue-50 border border-blue-100"
              : "text-gray-600"
              }`}
            title={isCollapsed ? "Trash" : undefined}
          >
            <BsTrash className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Trash</span>}
          </a>

        </nav>

        {/* Shared Section */}
        {!isCollapsed && (
          <div className="mt-6">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Shared with me
            </div>
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <BsFolder className="w-4 h-4" />
              Models
            </a>
          </div>
        )}
      </div>

      {/* Profile Section with Hover Dropdown */}
      <div className="relative group px-4 mb-6">
        <div 
          className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} p-2 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200`}
        >
          {user?.avatar ? (
            <div className="w-9 h-9 rounded-full overflow-hidden shadow-sm flex-shrink-0 border-2 border-white">
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm flex-shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {userInitial}
            </div>
          )}

        </div>

        {/* Hover Dropdown */}
        <div className={`absolute bottom-full ${collapsed ? 'left-14' : 'left-4'} mb-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-1 overflow-hidden`}>
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-900 truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => router.push("/dashboard/profile")}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            <FiUser className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <FiLogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Bottom Actions */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200/50 space-y-1">
          <button className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">
            Help & Support
          </button>
          <button className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">
            Documentation
          </button>
        </div>
      )}


    </div>
  );
}
