import { motion } from "framer-motion";

export default function MobileBlocker() {
  return (
    <div className="relative flex flex-col items-center justify-center h-screen bg-black text-white text-center px-6 overflow-hidden">
      {/* Floating background blobs */}
      <motion.div
        className="absolute w-40 h-40 bg-blue-600 rounded-full blur-3xl opacity-20"
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -20, 20, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "15%", left: "10%" }}
      />
      <motion.div
        className="absolute w-52 h-52 bg-purple-600 rounded-full blur-3xl opacity-20"
        animate={{
          x: [0, -25, 25, 0],
          y: [0, 30, -20, 0],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        style={{ bottom: "20%", right: "15%" }}
      />
      <motion.div
        className="absolute w-32 h-32 bg-pink-600 rounded-full blur-3xl opacity-20"
        animate={{
          x: [0, 20, -15, 0],
          y: [0, -15, 15, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "50%", left: "40%" }}
      />

      {/* Main Text */}
      <motion.h1
        className="text-3xl font-bold mb-4 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        Dashboard Unavailable on Mobile
      </motion.h1>

      <motion.p
        className="text-lg text-gray-300 max-w-md relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        For the best experience, please access the dashboard on a{" "}
        <span className="text-blue-400 font-medium">desktop device</span>.  
        We’ve optimized it for larger screens so you can get the most out of it.
      </motion.p>
    </div>
  );
}

