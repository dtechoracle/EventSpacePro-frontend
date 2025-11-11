"use client";

import Image from "next/image";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useUserStore } from "@/store/userStore";
import { FiLogOut } from "react-icons/fi";

const Sidebar = () => {
  const router = useRouter();
  const { pathname } = router;
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { user, fetchUser } = useUserStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = () => {
    localStorage.clear()
    router.push("/auth/login")
  }

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
        className="relative bg-[var(--accent)]/5 h-screen px-3 py-8 flex-col justify-between hidden lg:flex"
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
            <AnimatePresence>
              {!isCollapsed && (
                <motion.h1
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm text-[#272235] group-hover:text-black font-medium"
                >
                  Settings
                </motion.h1>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 hover:bg-black/5 group p-3 rounded-md cursor-pointer">
            <Image
              src={"/assets/sidebar/SignOut.svg"}
              alt="Logout"
              width={20}
              height={20}
            />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.h1
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm text-[#272235] group-hover:text-black font-medium"
                >
                  Logout
                </motion.h1>
              )}
            </AnimatePresence>
          </div>

          <div>
            {/* Profile Section */}
            <div className="bg-white rounded-full flex justify-between items-center p-2">
              <div className="flex gap-2 items-center">
                <Image
                  src={"/assets/sidebar/sample-profile.svg"}
                  alt="Profile"
                  width={40}
                  height={40}
                />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <h1 className="font-semibold text-sm">
                        {user?.firstName} {user?.lastName}
                      </h1>
                      <p className="text-xs">Basic plan</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {!isCollapsed && (
                <Image
                  src={"/assets/sidebar/chevron-down.svg"}
                  alt="Dropdown"
                  width={20}
                  height={20}
                />
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="mt-3 flex items-center gap-2 text-red-600 hover:bg-red-50 transition-colors w-full p-2 rounded-lg"
            >
              <FiLogOut size={20} />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm font-medium"
                  >
                    Logout
                  </motion.span>
                )}
              </AnimatePresence>
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

      {/* Mobile Sidebar (unchanged) */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed top-1 left-1 z-50 p-3 rounded-lg shadow-lg bg-[var(--accent)] text-white lg:hidden transition-transform ${open ? "translate-x-52" : "translate-x-0"
          }`}
      >
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 h-full w-64 bg-[#F6F4FA] px-3 py-8 flex flex-col justify-between z-40 lg:hidden"
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
                <div className="flex gap-2">
                  <Image
                    src={"/assets/sidebar/sample-profile.svg"}
                    alt="Profile"
                    width={40}
                    height={40}
                  />
                  <div>
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
