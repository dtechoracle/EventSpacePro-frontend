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
                    set({ user: response.data, isLoading: false, error: null });
                } catch (error: any) {
                    set({
                        user: null,
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
