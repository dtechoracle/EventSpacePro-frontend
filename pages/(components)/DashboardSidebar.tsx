"use client";

import { useEffect, useState } from "react";
import { BsFolder, BsHeart, BsCalendar, BsStars, BsTrash, BsChevronLeft, BsChevronRight } from "react-icons/bs";
import { FiLogOut } from "react-icons/fi";
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
    <div className={`${collapsed ? 'w-16' : 'w-56'} bg-white/80 backdrop-blur-sm border-r border-gray-300/50 flex flex-col shadow-sm transition-all duration-300 relative`}>
      {/* Collapse Toggle Button */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3 top-4 z-10 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <BsChevronRight className="w-3 h-3" /> : <BsChevronLeft className="w-3 h-3" />}
      </button>
      {/* Profile Section */}
      <div className="p-4 border-b border-gray-200/50">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-md flex-shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {userInitial}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate text-gray-800">{userName}</div>
              <div className="text-xs text-gray-500 truncate">My Workspace</div>
            </div>
          )}
        </div>
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
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-sm font-semibold text-blue-600 bg-blue-50 rounded-lg border border-blue-100`}
            title={isCollapsed ? "My Events" : undefined}
          >
            <BsFolder className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>My Events</span>}
          </a>
          <a
            href="#"
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors`}
            title={isCollapsed ? "Favorites" : undefined}
          >
            <BsHeart className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Favorites</span>}
          </a>
          <a
            href="#"
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors`}
            title={isCollapsed ? "Templates" : undefined}
          >
            <BsCalendar className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Templates</span>}
          </a>
          <a
            href="#"
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors`}
            title={isCollapsed ? "AI Assistant" : undefined}
          >
            <BsStars className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>AI Assistant</span>}
          </a>
          <a
            href="#"
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors`}
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

      {/* Logout */}
      <div className="p-4 border-t border-gray-200/50">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center ${isCollapsed ? "justify-center" : "gap-2"} px-3 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors`}
          title="Logout"
        >
          <FiLogOut className="w-4 h-4" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}
