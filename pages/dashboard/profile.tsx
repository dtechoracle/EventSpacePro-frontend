import React, { useState, useEffect, useRef } from "react";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import { useUserStore } from "@/store/userStore";
import { FiCamera, FiSave, FiUser, FiMail, FiCalendar } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Head from "next/head";

export default function ProfilePage() {
    const { user, setUser } = useUserStore();
    const [firstName, setFirstName] = useState(user?.firstName || "");
    const [lastName, setLastName] = useState(user?.lastName || "");
    const [avatar, setAvatar] = useState(user?.avatar || "");
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || "");
            setLastName(user.lastName || "");
            setAvatar(user.avatar || "");
        }
    }, [user]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error("Image too large. Max 5MB.");
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const img = new Image();
                img.onload = () => {
                    // Create a canvas to downscale the image
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 200; // Profile photos don't need to be huge
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    // Convert to optimized JPEG with 0.8 quality
                    const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    setAvatar(optimizedDataUrl);
                };
                img.src = reader.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);

        try {
            // Simulate API call and update local state
            const updatedUser = {
                ...user,
                firstName,
                lastName,
                avatar,
                updatedAt: new Date().toISOString()
            };

            setUser(updatedUser);

            // Also persist to localStorage manually just in case, though persist middleware handles it
            localStorage.setItem("user-storage", JSON.stringify({ state: { user: updatedUser } }));

            toast.success("Profile updated successfully!");
        } catch (error) {
            toast.error("Failed to update profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const userInitial = firstName?.[0]?.toUpperCase() || user?.firstName?.[0]?.toUpperCase() || "U";

    return (
        <div className="flex h-screen bg-[#F8FAFC]">
            <Head>
                <title>Profile | EventSpace Pro</title>
            </Head>

            <DashboardSidebar />

            <main className="flex-1 overflow-y-auto p-8 lg:p-12">
                <div className="max-w-4xl mx-auto">
                    <header className="mb-10">
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Account Settings</h1>
                        <p className="text-gray-500 mt-2">Manage your personal information and profile preferences.</p>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left: Avatar Upload */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col items-center">
                                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-blue-500 flex items-center justify-center text-white text-4xl font-bold transition-transform group-hover:scale-105">
                                        {avatar ? (
                                            <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            userInitial
                                        )}
                                    </div>
                                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <FiCamera className="text-white text-2xl" />
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                </div>

                                <h3 className="mt-4 font-semibold text-gray-900 text-lg">Your Photo</h3>
                                <p className="text-sm text-gray-500 text-center mt-1">Click to upload a new profile picture. Recommended: 500x500px.</p>

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-all"
                                >
                                    Change Photo
                                </button>
                            </div>
                        </div>

                        {/* Right: Info Form */}
                        <div className="lg:col-span-2 space-y-6">
                            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <FiUser className="text-blue-500" /> Personal Information
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700">First Name</label>
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            placeholder="Enter first name"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700">Last Name</label>
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            placeholder="Enter last name"
                                        />
                                    </div>
                                </div>

                                <div className="mt-6 space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Email Address</label>
                                    <div className="relative">
                                        <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="email"
                                            value={user?.email || ""}
                                            disabled
                                            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 outline-none cursor-not-allowed"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1 italic">Email cannot be changed manually for security reasons.</p>
                                </div>
                            </section>

                            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <FiCalendar className="text-blue-500" /> Account Details
                                </h2>
                                <div className="flex items-center justify-between py-3 border-b border-gray-50">
                                    <span className="text-sm text-gray-500">Member Since</span>
                                    <span className="text-sm font-medium text-gray-900">
                                        {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "March 2026"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between py-3">
                                    <span className="text-sm text-gray-500">Account status</span>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Active
                                    </span>
                                </div>
                            </section>

                            <div className="flex items-center justify-end pt-4">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={`flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100`}
                                >
                                    {isSaving ? (
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                        >
                                            <FiSave className="w-4 h-4" />
                                        </motion.div>
                                    ) : <FiSave className="w-4 h-4" />}
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
