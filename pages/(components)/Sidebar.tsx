"use client";

import Image from "next/image";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useUserStore } from "@/store/userStore";
import { FiLogOut, FiUser } from "react-icons/fi";
import Cookies from "js-cookie";

const Sidebar = () => {
  const router = useRouter();
  const { pathname } = router;
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { user, fetchUser, clearUser } = useUserStore();

  const handleLogout = () => {
    Cookies.remove("authToken");
    clearUser();
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("user-storage");
        localStorage.removeItem("auth-token");
      }
    } catch {}
    router.push("/auth/login");
  };

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Load persisted state from localStorage on component mount
  useEffect(() => {
    // Check if we're on the client side
    if (typeof window !== "undefined") {
      const savedCollapsedState = localStorage.getItem("sidebar-collapsed");
      const savedMobileState = localStorage.getItem("sidebar-mobile-open");

      if (savedCollapsedState !== null) {
        setIsCollapsed(JSON.parse(savedCollapsedState));
      }

      if (savedMobileState !== null) {
        setOpen(JSON.parse(savedMobileState));
      }
    }
  }, []);

  // Save desktop collapse state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
    }
  }, [isCollapsed]);

  // Save mobile open state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-mobile-open", JSON.stringify(open));
    }
  }, [open]);

  const links = [
    {
      icon: "/assets/sidebar/SquaresFour.svg",
      text: "Dashboard",
      route: "/dashboard",
    },
    {
      icon: "/assets/sidebar/DropboxLogo.svg",
      text: "Projects",
      route: "/dashboard/projects",
    },
    {
      icon: "/assets/sidebar/CalendarCheck.svg",
      text: "Events",
      route: "/dashboard/events",
    },
    {
      icon: "/assets/sidebar/ChartScatter.svg",
      text: "Analytics",
      route: "/dashboard/analytics",
    },
    {
      icon: "/assets/sidebar/Sparkle.svg",
      text: "AI",
      route: "/dashboard/ai",
    },
    {
      icon: "/assets/sidebar/BellRinging.svg",
      text: "Notifications",
      route: "/dashboard/notification",
    },
    {
      icon: "/assets/sidebar/CalendarDots.svg",
      text: "Calendar",
      route: "/dashboard/calendar",
    },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: isCollapsed ? "5rem" : "13rem" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="relative z-50 bg-[var(--accent)]/5 h-screen px-3 py-8 flex-col justify-between hidden lg:flex"
      >
        <div>
          <div className="w-full flex justify-center">
            <Image
              alt=""
              src={"/assets/mainLogo.svg"}
              width={isCollapsed ? 50 : 200}
              height={isCollapsed ? 50 : 200}
            />
          </div>

          <div className="pt-8 space-y-1">
            {links.map((item, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 hover:bg-black/5 group p-3 rounded-md cursor-pointer ${item.route === pathname ? "bg-black/5" : ""
                  }`}
                onClick={() => router.push(item.route)}
              >
                <Image src={item.icon} alt={item.text} width={20} height={20} />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.h1
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm text-[#272235] group-hover:text-black font-medium"
                    >
                      {item.text}
                    </motion.h1>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        <div className="relative group flex justify-center mb-2">
          {/* Profile Icon Only */}
          <div className="bg-white rounded-full p-2 cursor-pointer shadow-sm hover:ring-2 hover:ring-blue-400 transition-all">
            {user?.avatar ? (
              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold bg-blue-500"
              >
                {user?.firstName?.[0]?.toUpperCase() || "U"}
              </div>
            )}
          </div>

          {/* Hover Dropdown */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-1 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
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

        {/* Collapse / Expand Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute top-1/2 -right-3 transform -translate-y-1/2 bg-white shadow-lg rounded-full p-1"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </motion.aside>

      {/* Mobile top bar + toggle */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-white/90 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <Image
            alt="EventSpacePro"
            src={"/assets/mainLogo.svg"}
            width={120}
            height={32}
          />
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center justify-center rounded-md bg-[var(--accent)] p-2 text-white shadow"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 z-40 flex h-full w-64 flex-col justify-between bg-[#F6F4FA] px-3 py-8 pt-16 lg:hidden"
          >
            <div>
              <div className="w-full flex">
                <Image
                  alt=""
                  src={"/assets/mainLogo.svg"}
                  width={150}
                  height={150}
                />
              </div>
              <div className="pt-8 space-y-1">
                {links.map((item, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-2 hover:bg-black/5 group p-3 rounded-md cursor-pointer ${item.route === pathname ? "bg-black/5" : ""
                      }`}
                    onClick={() => {
                      router.push(item.route);
                      setOpen(false);
                    }}
                  >
                    <Image
                      src={item.icon}
                      alt={item.text}
                      width={20}
                      height={20}
                    />
                    <h1 className="text-sm text-[#272235] group-hover:text-black font-medium">
                      {item.text}
                    </h1>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full gap-2">
              <div
                className={`flex items-center gap-2 hover:bg-black/5 group p-3 rounded-md cursor-pointer ${pathname === "dashboard/settings" ? "bg-black/5" : ""
                  }`}
              >
                <Image
                  src={"/assets/sidebar/Gear.svg"}
                  alt="Settings"
                  width={20}
                  height={20}
                />
                <h1 className="text-sm text-[#272235] group-hover:text-black font-medium">
                  Settings
                </h1>
              </div>

              <div className="flex items-center gap-2 hover:bg-black/5 group p-3 rounded-md cursor-pointer">
                <Image
                  src={"/assets/sidebar/SignOut.svg"}
                  alt="Logout"
                  width={20}
                  height={20}
                />
                <h1 className="text-sm text-[#272235] group-hover:text-black font-medium">
                  Logout
                </h1>
              </div>

              <div className="bg-white rounded-full flex justify-between items-center p-2">
                <div className="flex gap-2 items-center">
                  {user?.avatar ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm flex-shrink-0 border-2 border-white">
                      <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm flex-shrink-0 bg-blue-500"
                      style={{ width: 40, height: 40 }}
                    >
                      {user?.firstName?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                  <div className="ml-1">
                    <h1 className="font-semibold text-sm">
                      {user?.firstName} {user?.lastName}
                    </h1>
                    <p className="text-xs">Basic plan</p>
                  </div>
                </div>
                <Image
                  src={"/assets/sidebar/chevron-down.svg"}
                  alt="Dropdown"
                  width={20}
                  height={20}
                />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
