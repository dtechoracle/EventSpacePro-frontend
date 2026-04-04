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
      <div className={`pt-8 pb-4 flex items-center ${collapsed ? 'justify-center' : 'px-4'}`}>
        {!collapsed ? (
          <img 
            src="/assets/mainLogo.svg" 
            alt="Logo" 
            className="h-11 w-auto object-contain" 
          />
        ) : (
          <img 
            src="/assets/small-logo.png" 
            alt="Logo" 
            className="w-8 h-8 object-contain" 
          />
        )}
      </div>

      {/* Profile Section (Permanent, visible when collapsed as icon) */}
      <div className={`px-5 pb-6 border-b border-gray-100/50 flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3'}`}>
        <div className="relative group/avatar cursor-pointer" onClick={() => router.push("/dashboard/profile")}>
          {user?.avatar ? (
            <div className={`rounded-full overflow-hidden shadow-sm flex-shrink-0 border-2 border-white transition-transform hover:scale-110 ${collapsed ? 'w-9 h-9' : 'w-10 h-10'}`}>
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className={`rounded-full flex items-center justify-center text-white font-semibold shadow-sm flex-shrink-0 transition-transform hover:scale-110 ${collapsed ? 'w-9 h-9 text-[10px]' : 'w-10 h-10 text-xs'}`}
              style={{ backgroundColor: avatarColor }}
            >
              {userInitial}
            </div>
          )}
          {collapsed && (
            <div className="absolute -right-1 -bottom-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>
          )}
        </div>
        {!collapsed && (
          <div className="flex flex-col overflow-hidden">
            <p className="text-[13px] font-bold text-gray-900 truncate tracking-tight">{userName}</p>
            <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-2 pt-4">
        <nav className="space-y-1">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              router.push("/dashboard");
            }}
            className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 text-sm rounded-lg transition-colors ${router.pathname === "/dashboard"
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
            className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 text-sm rounded-lg transition-colors ${router.pathname === "/dashboard/favorites"
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
            className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 text-sm hover:bg-gray-50 rounded-lg transition-colors ${router.pathname === "/dashboard/templates"
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
            className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 text-sm hover:bg-gray-50 rounded-lg transition-colors ${router.pathname === "/dashboard/ai"
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
            className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 text-sm hover:bg-gray-50 rounded-lg transition-colors ${router.pathname === "/dashboard/trash"
              ? "font-semibold text-blue-600 bg-blue-50 border border-blue-100"
              : "text-gray-600"
              }`}
            title={isCollapsed ? "Trash" : undefined}
          >
            <BsTrash className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Trash</span>}
          </a>
        </nav>
      </div>

      {/* Logout at bottom */}
      <div className="p-4 border-t border-gray-100 mt-auto">
        <button 
          onClick={handleLogout}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-medium`}
        >
          <FiLogOut className="w-4 h-4" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>


    </div>
  );
}
