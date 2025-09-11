import { useState } from "react";
import Image from "next/image";
import AuthLayout from "../layouts/AuthLayout";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import toast from "react-hot-toast";
import { ApiError } from "next/dist/server/api-utils"
import { useRouter } from "next/router";


const RequestPasswordReset = () => {
  const [email, setEmail] = useState("");
  const router = useRouter()

  const mutation = useMutation<{ message: string }, ApiError>({
    mutationKey: ["auth-request-password-reset"],
    mutationFn: () => apiRequest("/auth/request-otp", "POST", { email }),
    onSuccess: (data) => {
      toast.success(data.message || "Password reset link sent!");
      console.log("dadtattta", data)
      router.push("/auth/verify-otp")
      localStorage.setItem("verifyType", "reset")
      localStorage.setItem("email", email)
    },
    onError: (err) => {
      const message =

        err?.message || "Request failed";
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
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

          <h1 className="text-2xl font-bold text-gray-900">
            Forgot Password?
          </h1>
          <p className="text-black/75 font-medium text-sm mt-1 text-center">
            Enter your email and we’ll send you a reset link
          </p>

          <form onSubmit={handleSubmit} className="w-full mt-6 space-y-4">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E1CD8]"
            />
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-[#4E1CD8] text-white py-2 rounded-lg font-medium hover:bg-white hover:text-[#4E1CD8] border-2 border-[#4E1CD8] transition disabled:opacity-50"
            >
              {mutation.isPending ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
};

export default RequestPasswordReset;

