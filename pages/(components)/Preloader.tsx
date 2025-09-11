import React from "react";
import { LuLoader } from "react-icons/lu";

const Preloader = () => {
  return (
    <div className="w-screen h-screen fixed inset-0 z-[99999] bg-black/70 flex justify-center items-center backdrop-blur-md">
      <div className="animate-spin">
        <LuLoader className="text-white text-4xl"/>
      </div>
    </div>
  );
};

export default Preloader;
