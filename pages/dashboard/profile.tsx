import React, { useState, useEffect, useRef } from "react";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import { useUserStore } from "@/store/userStore";
import toast from "react-hot-toast";
import Head from "next/head";
import { apiRequest } from "@/helpers/Config";

export default function ProfilePage() {
    const { user, setUser } = useUserStore();
    const [firstName, setFirstName] = useState(user?.firstName || "");
    const [lastName, setLastName] = useState(user?.lastName || "");
    const [avatar, setAvatar] = useState(user?.avatar || "");
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || "");
            setLastName(user.lastName || "");
            setAvatar(user.avatar || "");
            setAvatarFile(null);
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
                    const canvas = document.createElement("canvas");
                    const MAX_SIZE = 400;
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
                    const ctx = canvas.getContext("2d");
                    ctx?.drawImage(img, 0, 0, width, height);

                    const optimizedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                toast.error("Failed to process image.");
                                return;
                            }
                            setAvatar(optimizedDataUrl);
                            setAvatarFile(
                                new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
                                    type: "image/jpeg",
                                })
                            );
                        },
                        "image/jpeg",
                        0.85
                    );
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
            let savedAvatar = avatar;

            if (avatarFile) {
                const formData = new FormData();
                formData.append("avatar", avatarFile);

                const avatarResponse = await apiRequest("/user/avatar", "POST", formData, true);
                const avatarPayload = avatarResponse?.data || avatarResponse;
                savedAvatar =
                    avatarPayload?.avatar ||
                    avatarPayload?.data?.avatar ||
                    avatarPayload?.url ||
                    avatar;
            }

            const updatedUser = {
                ...user,
                firstName,
                lastName,
                avatar: savedAvatar,
                updatedAt: new Date().toISOString(),
            };

            setUser(updatedUser);
            localStorage.setItem("user-storage", JSON.stringify({ state: { user: updatedUser } }));

            if (savedAvatar) {
                localStorage.setItem(`avatar_${user._id}`, savedAvatar);
            }

            setAvatarFile(null);
            toast.success("Profile updated successfully!");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const userInitial = firstName?.[0]?.toUpperCase() || user?.firstName?.[0]?.toUpperCase() || "U";
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Your Name";

    return (
        <div className="flex h-screen bg-gray-50">
            <Head>
                <title>Profile | EventSpace Pro</title>
            </Head>

            <DashboardSidebar />

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-6 py-10">
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">

                        <div className="p-8 pb-6">
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

                                <div
                                    className="relative group cursor-pointer flex-shrink-0"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 ring-4 ring-white shadow-md">
                                        {avatar ? (
                                            <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-[var(--accent)] text-white text-4xl font-semibold">
                                                {userInitial}
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                </div>

                                <div className="flex-1 text-center sm:text-left">
                                    <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
                                    <p className="mt-1 text-sm text-gray-500">{user?.email || "No email"}</p>
                                </div>
                            </div>
                        </div>

                        <div className="px-8 pb-8 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">First name</label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="mt-2 w-full px-0 py-2.5 border-0 border-b border-gray-200 focus:border-[var(--accent)] focus:ring-0 outline-none text-sm text-gray-900 bg-transparent transition-colors"
                                    placeholder="First name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Last name</label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="mt-2 w-full px-0 py-2.5 border-0 border-b border-gray-200 focus:border-[var(--accent)] focus:ring-0 outline-none text-sm text-gray-900 bg-transparent transition-colors"
                                    placeholder="Last name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <div className="mt-2 px-0 py-2.5 border-b border-gray-200 text-sm text-gray-400">
                                    {user?.email || "No email"}
                                </div>
                                <p className="mt-1.5 text-xs text-gray-400">Email cannot be changed for security reasons.</p>
                            </div>
                        </div>

                        <div className="px-8 pb-8">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full py-3 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all disabled:opacity-50"
                            >
                                {isSaving ? "Saving..." : "Save changes"}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
