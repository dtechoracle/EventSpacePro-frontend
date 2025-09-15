import Image from "next/image";
import AuthLayout from "../layouts/AuthLayout";
import { useRouter } from "next/router";
import { useState } from "react";
import { apiRequest } from "@/helpers/Config";
import { ApiError } from "@/interfaces/index"
import { useMutation } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { Eye, EyeOff } from "lucide-react";
import Cookies from "js-cookie"

const ResetPassword = () => {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); const token = Cookies.get("authToken")

  const mutation = useMutation({
    mutationKey: ["reset-password"],
    mutationFn: () => apiRequest("/auth/reset-password", "POST", {
      token,
      newPassword,
    }, false),
    onSuccess: () => {
      toast.success("Account created successfully! OTP sent to your email");
      router.push("/auth/login");
    },
    onError: (err: ApiError) => {
      toast.error(err.message || "Signup failed");
    },

  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    mutation.mutate()
  };

  return (
    <AuthLayout>
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-full max-w-md bg-white p-8 flex flex-col items-center">
          <div className="mb-12 lg:hidden">
            <Image
              alt=""
              src={"/assets/mainLogo.svg"}
              width={200}
              height={200}
            />
          </div>

          <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
          <p className="text-black/75 font-medium text-sm mt-1">
            Create a new password for your account
          </p>

          <form onSubmit={handleSubmit} className="w-full mt-6 space-y-4">
            {/* New Password */}
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Confirm Password */}
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full bg-[var(--accent)] text-white py-2 rounded-lg font-medium hover:bg-white hover:text-[var(--accent)] border-2 border-[var(--accent)] transition"
            >
              Reset Password
            </button>
          </form>
          <span className="mt-6 text-sm text-gray-600 flex gap-1">
            Remembered your password?{" "}
            <p
              className="text-[var(--accent)] font-medium hover:underline cursor-pointer"
              onClick={() => router.push("/auth/login")}
            >
              Log In
            </p>
          </span>
        </div>
      </div>
    </AuthLayout>
  );
};

export default ResetPassword;

