import { useState, useRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import AuthLayout from "../layouts/AuthLayout";
import { useRouter } from "next/router";
import { apiRequest } from "@/helpers/Config";
import toast from "react-hot-toast";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/interfaces/index"
import Cookies from "js-cookie";


const OtpVerification = () => {
  const router = useRouter();
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const buttonColor = "var(--accent)";

  const handleChange = (value: string, index: number) => {
    if (/^[0-9]?$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // move to next box
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d+$/.test(pasted)) {
      const newOtp = [...otp];
      pasted.split("").forEach((char, i) => {
        if (i < 6) newOtp[i] = char;
      });
      setOtp(newOtp);

      // focus last filled input
      const lastIndex = pasted.length - 1;
      if (inputRefs.current[lastIndex]) {
        inputRefs.current[lastIndex]?.focus();
      }
    }
  };

  const allFilled = otp.every((digit) => digit !== "");

  const mutation = useMutation({
    mutationKey: ["auth-verify-otp"],
    mutationFn: async () => {
      const code = otp.join("");
      const email = localStorage.getItem("email")
      if (!email) router.push("/auth/signup")
      const res = await apiRequest("/auth/verify-otp", "POST", { email, otp: code }, false);
      return res;
    },
    onSuccess: (data) => {
      toast.success("OTP verified successfully!");
      Cookies.set("authToken", data.token);
      localStorage.removeItem("email")
      const verifyType = localStorage.getItem("verifyType")
      if (verifyType == "reset") {
        localStorage.removeItem("verifyType")
        router.push("/auth/reset-password");
      } else {
        localStorage.removeItem("verifyType")
        router.push("/dashboard");
      }
    },
    onError: (err: ApiError) => {
      toast.error(err.message || "OTP verification failed");
    },
  });

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
          <h1 className="text-2xl font-bold text-gray-900">OTP Verification</h1>
          <p className="text-black/75 font-medium text-sm mt-1">
            Enter the 6-digit code sent to your email
          </p>

          <div className="flex gap-3 mt-8">
            {otp.map((digit, i) => (
              <motion.input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(e.target.value, i)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                onPaste={handlePaste}
                className="w-12 h-12 text-center text-lg rounded-lg border-2 focus:outline-none"
                style={{
                  borderColor: allFilled ? buttonColor : "#d1d5db", // gray-300
                }}
                animate={
                  allFilled
                    ? { scale: 1.1, borderColor: buttonColor }
                    : { scale: 1 }
                }
                transition={{ type: "spring", stiffness: 300 }}
              />
            ))}
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full mt-5 bg-[var(--accent)] text-white py-2 rounded-lg font-medium hover:bg-white hover:text-[var(--accent)] border-2 border-[var(--accent)] transition disabled:opacity-50"
          >
            {mutation.isPending ? "Verifying" : "Verify OTP"}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};

export default OtpVerification;

