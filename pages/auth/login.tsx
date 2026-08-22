import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import AuthLayout from "../layouts/AuthLayout";
import { useRouter } from "next/router";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { apiRequest } from "@/helpers/Config";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

interface ApiError {
  message: string;
  errors?: { path: string; message: string; code: string }[];
}

const Login = () => {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (lockoutSeconds > 0) {
      timerRef.current = setInterval(() => {
        setLockoutSeconds((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockoutSeconds > 0]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const mutation = useMutation({
    mutationKey: ["auth-login"],
    mutationFn: () => apiRequest("/login", "POST", {
      email: form.email,
      password: form.password,
    }, false),
    onSuccess: (data: any) => {
      if (data?.code === "EMAIL_NOT_VERIFIED" || data?.data?.code === "EMAIL_NOT_VERIFIED") {
        localStorage.setItem("email", form.email);
        toast.error("Please verify your email first");
        router.push("/auth/verify-email");
        return;
      }

      if (!data?.token) {
        toast.error("Login failed. No token received.");
        return;
      }

      toast.success("Logged in successfully!");
      Cookies.set("authToken", data.token, { path: "/" });
      const redirectTo = router.query.redirect as string || "/dashboard";
      router.push(redirectTo);
    },
    onError: (err: any) => {
      const message = err?.errors?.[0]?.message || err.message || "Login failed";

      if (message.includes("locked") || message.includes("Too many")) {
        const retryAfter = err?.retryAfter || 875;
        setLockoutSeconds(retryAfter);
        toast.error("Account locked. Try again later.");
        return;
      }

      if (message.includes("EMAIL_NOT_VERIFIED") || message.includes("verify your email")) {
        localStorage.setItem("email", form.email);
        toast.error("Please verify your email first");
        router.push("/auth/verify-email");
        return;
      }

      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("email", form.email);
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

          {lockoutSeconds > 0 && (
            <div className="w-full mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-center">
              <p className="text-sm text-red-600 font-medium">
                Account temporarily locked
              </p>
              <p className="text-xs text-red-500 mt-1">
                Try again in <span className="font-mono font-bold">{Math.floor(lockoutSeconds / 60)}:{(lockoutSeconds % 60).toString().padStart(2, "0")}</span>
              </p>
            </div>
          )}

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
              className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />

            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
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
              disabled={mutation.isPending || lockoutSeconds > 0}
              className="w-full bg-[var(--accent)] text-white py-2 rounded-lg font-medium hover:bg-white hover:text-[var(--accent)] border-2 border-[var(--accent)] transition disabled:opacity-50"
            >
              {mutation.isPending ? "Logging In..." : "Log In"}
            </button>
          </form>

          <span className="mt-6 text-sm text-gray-600 flex gap-1">
            Don&apos;t have an account?{" "}
            <p
              className="text-[var(--accent)] font-medium hover:underline cursor-pointer"
              onClick={() => router.push("/auth/signup")}
            >
              Sign Up
            </p>
          </span>
          <span className="mt-4 text-sm text-gray-600 flex gap-1">
            Forgot your password?{" "}
            <p
              className="text-[var(--accent)] font-medium hover:underline cursor-pointer"
              onClick={() => router.push("/auth/request-password-reset")}
            >
              Reset here
            </p>
          </span>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Login;
