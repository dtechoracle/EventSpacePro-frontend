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

                    set((state) => {
                        const combinedUser = state.user ? { ...state.user, ...userData } : userData;

                        // "Local Storage for Now": If backend returns no avatar but we have a local one, 
                        // explicitly preserve our local Base64 image.
                        if (state.user?.avatar && !userData.avatar) {
                            combinedUser.avatar = state.user.avatar;
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
