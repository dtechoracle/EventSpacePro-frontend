import Image from "next/image";
import AuthLayout from "../layouts/AuthLayout";
import { useRouter } from "next/router";
import { useState } from "react";
import { apiRequest } from "@/helpers/Config";

const ResetPassword = () => {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      await apiRequest("/auth/reset-password", "POST", {
        password: newPassword,
      });
      router.push("/auth/login");
    } catch (err: any) {
      console.error("Reset failed:", err.message);
    }
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

          <form
            onSubmit={handleSubmit}
            className="w-full mt-6 space-y-4"
          >
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E1CD8]"
            />
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E1CD8]"
            />
            <button
              type="submit"
              className="w-full bg-[#4E1CD8] text-white py-2 rounded-lg font-medium hover:bg-white hover:text-[#4E1CD8] border-2 border-[#4E1CD8] transition"
            >
              Reset Password
            </button>
          </form>

          <span className="mt-6 text-sm text-gray-600 flex gap-1">
            Remembered your password?{" "}
            <p
              className="text-[#4E1CD8] font-medium hover:underline cursor-pointer"
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

