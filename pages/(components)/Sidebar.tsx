"use client";

import Image from "next/image";
import { useRouter } from "next/router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const Sidebar = () => {
  const router = useRouter();
  const { pathname } = router;
  const [open, setOpen] = useState(false);

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
      <aside className="bg-[#F6F4FA] w-1/5 h-screen px-3 py-8 flex-col justify-between hidden md:flex">
        <div>
          <div className="w-full flex">
            <Image alt="" src={"/assets/mainLogo.svg"} width={200} height={200} />
          </div>

          <div className="pt-8 space-y-1">
            {links.map((item, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 hover:bg-black/5 group p-3 rounded-md ${
                  item.route === pathname ? "bg-black/5" : ""
                }`}
                onClick={() => router.push(item.route)}
              >
                <Image src={item.icon} alt={item.text} width={20} height={20} />
                <h1 className="text-sm text-[#272235] group-hover:text-black font-medium">
                  {item.text}
                </h1>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full gap-2">
          <div
            className={`flex items-center gap-2 hover:bg-black/5 group p-3 rounded-md ${
              pathname === "dashboard/settings" ? "bg-black/5" : ""
            }`}
          >
            <Image src={"assets/sidebar/Gear.svg"} alt="Settings" width={20} height={20} />
            <h1 className="text-sm text-[#272235] group-hover:text-black font-medium">
              Settings
            </h1>
          </div>

          <div className="flex items-center gap-2 hover:bg-black/5 group p-3 rounded-md">
            <Image src={"assets/sidebar/SignOut.svg"} alt="Logout" width={20} height={20} />
            <h1 className="text-sm text-[#272235] group-hover:text-black font-medium">
              Logout
            </h1>
          </div>

          <div className="bg-white rounded-full flex justify-between items-center p-2">
            <div className="flex gap-2">
              <Image
                src={"assets/sidebar/sample-profile.svg"}
                alt="Profile"
                width={40}
                height={40}
              />
              <div>
                <h1 className="font-semibold text-sm">John Doe</h1>
                <p className="text-xs">Basic plan</p>
              </div>
            </div>
            <Image src={"assets/sidebar/chevron-down.svg"} alt="Dropdown" width={20} height={20} />
          </div>
        </div>
      </aside>

      <button
        onClick={() => setOpen(!open)}
        className={`fixed top-1 left-1 z-50 p-3 rounded-lg shadow-lg bg-[#4E1CD8] text-white md:hidden transition-transform ${
          open ? "translate-x-52" : "translate-x-0"
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
            className="fixed top-0 left-0 h-full w-64 bg-[#F6F4FA] px-3 py-8 flex flex-col justify-between z-40 md:hidden"
          >
            <div>
              <div className="w-full flex">
                <Image alt="" src={"/assets/mainLogo.svg"} width={150} height={150} />
              </div>
              <div className="pt-8 space-y-1">
                {links.map((item, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-2 hover:bg-black/5 group p-3 rounded-md ${
                      item.route === pathname ? "bg-black/5" : ""
                    }`}
                    onClick={() => {
                      router.push(item.route);
                      setOpen(false);
                    }}
                  >
                    <Image src={item.icon} alt={item.text} width={20} height={20} />
                    <h1 className="text-sm text-[#272235] group-hover:text-black font-medium">
                      {item.text}
                    </h1>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full gap-2">
              <div
                className={`flex items-center gap-2 hover:bg-black/5 group p-3 rounded-md ${
                  pathname === "dashboard/settings" ? "bg-black/5" : ""
                }`}
              >
                <Image src={"assets/sidebar/Gear.svg"} alt="Settings" width={20} height={20} />
                <h1 className="text-sm text-[#272235] group-hover:text-black font-medium">
                  Settings
                </h1>
              </div>

              <div className="flex items-center gap-2 hover:bg-black/5 group p-3 rounded-md">
                <Image src={"assets/sidebar/SignOut.svg"} alt="Logout" width={20} height={20} />
                <h1 className="text-sm text-[#272235] group-hover:text-black font-medium">
                  Logout
                </h1>
              </div>

              <div className="bg-white rounded-full flex justify-between items-center p-2">
                <div className="flex gap-2">
                  <Image
                    src={"assets/sidebar/sample-profile.svg"}
                    alt="Profile"
                    width={40}
                    height={40}
                  />
                  <div>
                    <h1 className="font-semibold text-sm">John Doe</h1>
                    <p className="text-xs">Basic plan</p>
                  </div>
                </div>
                <Image src={"assets/sidebar/chevron-down.svg"} alt="Dropdown" width={20} height={20} />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;

