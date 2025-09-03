import Image from "next/image";
import AuthLayout from "../layouts/AuthLayout";

const Login = () => {
  return (
    <AuthLayout>
      <div className="w-full h-full flex items-center justify-center">

        <div className="w-full max-w-md bg-white p-8 flex flex-col items-center">
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-600 text-sm mt-1">Login to your account</p>

          <button className="mt-6 w-full flex items-center justify-center gap-2 border rounded-lg py-2 hover:bg-gray-50">
            <Image src="/assets/google.svg" alt="Google" width={20} height={20} />
            <span className="text-sm font-medium text-gray-700">Continue with Google</span>
          </button>

          <div className="flex items-center w-full mt-6">
            <div className="flex-grow h-px bg-gray-300"></div>
            <span className="px-3 text-xs text-gray-500">OR</span>
            <div className="flex-grow h-px bg-gray-300"></div>
          </div>

          <form className="w-full mt-6 space-y-4">
            <input
              type="email"
              placeholder="Email"
              className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E1CD8]"
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full bg-[#27223508] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E1CD8]"
            />
            <button
              type="submit"
              className="w-full bg-[#4E1CD8] text-white py-2 rounded-lg font-medium hover:bg-white hover:text-[#4E1CD8] border-2 border-[#4E1CD8] transition"
            >
              Login
            </button>
          </form>

          <p className="mt-6 text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="text-[#4E1CD8] font-medium hover:underline">
              Signup
            </a>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Login;

