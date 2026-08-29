import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiRequest } from "@/helpers/Config";

export type User = {
    _id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: any; // For any additional fields from backend
};

type UserState = {
    user: User | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchUser: () => Promise<void>;
    setUser: (user: User) => void;
    clearUser: () => void;
};

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            user: null,
            isLoading: false,
            error: null,

            fetchUser: async () => {
                set({ isLoading: true, error: null });
                try {
                    const response = await apiRequest("/user", "GET", null, true);
                    const userData = response.data;

                    // The avatar is part of the user profile. There is no
                    // GET /user/avatar endpoint — only POST for uploads — so the
                    // extra request this used to make 404'd on every page load
                    // for every user and was caught and discarded anyway.
                    const avatarFromApi: string | null = userData?.avatar || null;

                    set((state) => {
                        // If we don't have a user in state yet, try to see if it's in localStorage 
                        // (though Zustand should have rehydrated it already)
                        let localAvatar = state.user?.avatar;
                        
                        // Fallback: Check localStorage manually if state is empty 
                        // This handles cases where fetchUser runs before rehydration finishes
                        if (!localAvatar && typeof window !== "undefined") {
                            try {
                                const stored = localStorage.getItem("user-storage");
                                if (stored) {
                                    const parsed = JSON.parse(stored);
                                    localAvatar = parsed.state?.user?.avatar;
                                }
                                
                                // Recover avatar from persistent ID-based storage (survives logouts)
                                if (!localAvatar && userData?._id) {
                                    const persistentAvatar = localStorage.getItem(`avatar_${userData._id}`);
                                    if (persistentAvatar) localAvatar = persistentAvatar;
                                }
                            } catch (e) {}
                        }

                        const combinedUser = state.user ? { ...state.user, ...userData } : userData;

                        if (avatarFromApi) {
                            combinedUser.avatar = avatarFromApi;
                        }

                        // "Local Storage for Now": If backend returns no avatar but we have one locally,
                        // explicitly preserve our local Base64 image.
                        if (!avatarFromApi && localAvatar && !userData.avatar) {
                            combinedUser.avatar = localAvatar;
                        }

                        return {
                            user: combinedUser,
                            isLoading: false,
                            error: null
                        };
                    });
                } catch (error: any) {
                    set({
                        isLoading: false,
                        error: error?.message || "Failed to fetch user profile",
                    });
                }
            },

            setUser: (user) => set({ user, error: null }),

            clearUser: () => set({ user: null, error: null }),
        }),
        {
            name: "user-storage", // for local persistence
        }
    )
);
