"use client";

import { useRouter } from "next/router";
import { BsThreeDotsVertical } from "react-icons/bs";

export default function EventCard({id} : {id: number}) {

  const router = useRouter()

  return (
    <div className="relative w-full h-60 rounded-3xl overflow-hidden shadow-lg" onClick={() => router.push(`/dashboard/editor/${id + 1}`)}>
      {/* Background with placeholder circles */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-green-300 rounded-full blur-3xl opacity-70" />
        <div className="absolute top-10 right-10 w-32 h-32 bg-yellow-300 rounded-full blur-3xl opacity-70" />
        <div className="absolute bottom-10 left-1/3 w-32 h-32 bg-blue-300 rounded-full blur-3xl opacity-70" />
      </div>

      {/* Frosted overlay */}
      <div className="absolute inset-0 bg-white/40 backdrop-blur-lg"></div>

      {/* Stylized grooves */}
      <div className="absolute top-0 left-0 w-full h-6 flex items-center justify-between px-4">
        <div className="w-10 h-1 bg-black rounded-full" />
        <div className="w-10 h-1 bg-black rounded-full" />
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 w-full p-4 flex justify-between items-end">
        <div>
          <h3 className="text-lg font-semibold text-black">Event 1</h3>
          <p className="text-sm text-gray-600">Edited 3 days ago</p>
        </div>
        <button className="p-2 rounded-full hover:bg-black/10">
          <BsThreeDotsVertical className="text-xl text-gray-700" />
        </button>
      </div>
    </div>
  );
}


