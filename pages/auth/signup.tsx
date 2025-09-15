import Image from "next/image"
import AuthLayout from "../layouts/AuthLayout"
import { useRouter } from "next/router"
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { apiRequest } from "@/helpers/Config"
import toast from "react-hot-toast"
import { ApiError } from "@/interfaces/index"
import { FiEye, FiEyeOff } from "react-icons/fi";

const Signup = () => {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  })

  const signupMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await apiRequest("/register", "POST", payload, false);

      const email = res?.data?.email;
      if (!email) throw new Error("No email returned from register response");

      localStorage.setItem("email", email)
      await apiRequest("/auth/request-otp", "POST", { email }, false);
      localStorage.setItem("verifyType", "register")

      return res.data;
    },
    onSuccess: () => {
      toast.success("Account created successfully! OTP sent to your email");
      router.push("/auth/verify-otp");
    },
    onError: (err: ApiError) => {
      toast.error(err.message || "Signup failed");
    },
  });
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    signupMutation.mutate(form)
  }

  return (
    <AuthLayout>
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-full max-w-md bg-white p-8 flex flex-col items-center">
          <div className="mb-12 lg:hidden">
            <Image
              alt="logo"
              src={"/assets/mainLogo.svg"}
              width={200}
              height={200}
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sign Up</h1>
          <p className="text-black/75 font-medium text-sm mt-1">
            Create an account to get started with us
          </p>

          <button className="mt-6 w-full flex items-center justify-center gap-2 border rounded-lg py-2 hover:bg-gray-50">
            <Image src="/assets/google.svg" alt="Google" width={20} height={20} />
            <span className="text-sm font-semibold text-black/70">
              Continue with google
            </span>
          </button>

          <div className="flex items-center w-full mt-6">
            <div className="flex-grow h-px bg-gray-300"></div>
            <span className="px-3 text-xs text-black/75 font-semibold">OR</span>
            <div className="flex-grow h-px bg-gray-300"></div>
          </div>

          {/* form */}
          <form
            onSubmit={handleSubmit}
            className="w-full mt-6 space-y-4"
          >
            <div className="flex gap-2">
              <input
                type="text"
                name="firstName"
                placeholder="First Name"
                value={form.firstName}
                onChange={handleChange}
                required
                className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <input
                type="text"
                name="lastName"
                placeholder="Last Name"
                value={form.lastName}
                onChange={handleChange}
                required
                className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />

            {/* Password field with toggle */}
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={signupMutation.isPending}
              className="w-full bg-[var(--accent)] text-white py-2 rounded-lg font-medium hover:bg-white hover:text-[var(--accent)] border-2 border-[var(--accent)] transition disabled:opacity-50"
            >
              {signupMutation.isPending ? "Signing Up..." : "Sign Up"}
            </button>
          </form>
          <span className="mt-6 text-sm text-gray-600 flex gap-1">
            Already have an account?
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
  )
}

export default Signup

