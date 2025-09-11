import { useState } from "react";
import Image from "next/image";
import AuthLayout from "../layouts/AuthLayout";
import { useRouter } from "next/router";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { apiRequest } from "@/helpers/Config";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

interface LoginResponse {
  token: string;
  data: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface ApiError {
  message: string;
  errors?: { path: string; message: string; code: string }[];
}

const Login = () => {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const mutation = useMutation<LoginResponse, ApiError>({
    mutationKey: ["auth-login"],
    mutationFn: () => apiRequest("/login", "POST", {
      email: form.email,
      password: form.password,
    }),
    onSuccess: (data) => {
      toast.success("Logged in successfully!");
      Cookies.set("authToken", data.token);
      router.push("/dashboard");
    },
    onError: (err) => {
      const message =
        err?.errors?.[0]?.message || err.message || "Login failed";
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
          <h1 className="text-2xl font-bold text-gray-900">Log In</h1>
          <p className="text-black/75 font-medium text-sm mt-1">
            Log in to continue with us
          </p>

          <button className="mt-6 w-full flex items-center justify-center gap-2 border rounded-lg py-2 hover:bg-gray-50">
            <Image
              src="/assets/google.svg"
              alt="Google"
              width={20}
              height={20}
            />
            <span className="text-sm font-semibold text-black/70">
              Continue with google
            </span>
          </button>

          <div className="flex items-center w-full mt-6">
            <div className="flex-grow h-px bg-gray-300"></div>
            <span className="px-3 text-xs text-black/75 font-semibold">OR</span>
            <div className="flex-grow h-px bg-gray-300"></div>
          </div>

          <form onSubmit={handleSubmit} className="w-full mt-6 space-y-4">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E1CD8]"
            />

            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E1CD8]"
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500"
              >
                {showPassword ? (
                  <AiOutlineEyeInvisible size={20} />
                ) : (
                  <AiOutlineEye size={20} />
                )}
              </span>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-[#4E1CD8] text-white py-2 rounded-lg font-medium hover:bg-white hover:text-[#4E1CD8] border-2 border-[#4E1CD8] transition disabled:opacity-50"
            >
              {mutation.isPending ? "Logging In..." : "Log In"}
            </button>
          </form>

          <span className="mt-6 text-sm text-gray-600 flex gap-1">
            Don&apos;t have an account?{" "}
            <p
              className="text-[#4E1CD8] font-medium hover:underline cursor-pointer"
              onClick={() => router.push("/auth/signup")}
            >
              Sign Up
            </p>
          </span>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Login;

