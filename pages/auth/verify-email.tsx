import { useState, useEffect } from "react";
import Image from "next/image";
import AuthLayout from "../layouts/AuthLayout";
import { useRouter } from "next/router";
import { apiRequest } from "@/helpers/Config";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { useUserStore } from "@/store/userStore";

const VerifyEmail = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("email");
    if (stored) setEmail(stored);
  }, []);

  const handleSendOtp = async () => {
    if (!email) {
      toast.error("No email found. Please go back to login.");
      return;
    }
    setSending(true);
    try {
      await apiRequest("/auth/request-otp", "POST", { email }, false);
      setOtpSent(true);
      toast.success("Verification code sent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send code");
    } finally {
      setSending(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (/^[0-9]?$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      if (value && index < 5) {
        const next = document.querySelector(`input[name="otp-${index + 1}"]`) as HTMLInputElement;
        next?.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prev = document.querySelector(`input[name="otp-${index - 1}"]`) as HTMLInputElement;
      prev?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      toast.error("Please enter the full 6-digit code");
      return;
    }
    setVerifying(true);
    try {
      const res = await apiRequest("/auth/verify-otp", "POST", { email, otp: code }, false);
      toast.success("Email verified!");
      Cookies.set("authToken", res.token, { path: "/" });
      try { await useUserStore.getState().fetchUser(); } catch (e) {}
      localStorage.removeItem("email");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-full max-w-md bg-white p-8 flex flex-col items-center">
          <div className="mb-12 lg:hidden">
            <Image alt="" src={"/assets/mainLogo.svg"} width={200} height={200} />
          </div>

          <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
          <p className="text-black/75 font-medium text-sm mt-1 text-center">
            We need to verify your email before you can continue
          </p>

          <div className="w-full mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 min-h-[42px]">
              {email || ""}
            </div>
          </div>

          {!otpSent ? (
            <button
              onClick={handleSendOtp}
              disabled={sending || !email}
              className="w-full mt-6 bg-[var(--accent)] text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send verification code"}
            </button>
          ) : (
            <>
              <p className="text-sm text-gray-500 mt-6 text-center">
                Enter the 6-digit code sent to <span className="font-semibold text-gray-900">{email}</span>
              </p>

              <div className="flex gap-3 mt-4 justify-center">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    name={`otp-${i}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, i)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    className="w-12 h-12 text-center text-lg rounded-lg border-2 border-gray-200 focus:border-[var(--accent)] focus:outline-none transition"
                  />
                ))}
              </div>

              <button
                onClick={handleVerify}
                disabled={verifying || otp.join("").length !== 6}
                className="w-full mt-6 bg-[var(--accent)] text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {verifying ? "Verifying..." : "Verify"}
              </button>

              <button
                onClick={handleSendOtp}
                disabled={sending}
                className="mt-4 text-sm text-[var(--accent)] font-medium hover:underline disabled:opacity-50"
              >
                {sending ? "Sending..." : "Resend code"}
              </button>
            </>
          )}

          <span className="mt-6 text-sm text-gray-600 flex gap-1">
            <p
              className="text-[var(--accent)] font-medium hover:underline cursor-pointer"
              onClick={() => router.push("/auth/login")}
            >
              Back to login
            </p>
          </span>
        </div>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmail;
