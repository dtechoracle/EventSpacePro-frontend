with open("pages/auth/verify-otp.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_paste = """  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d+$/.test(pasted)) {
      const newOtp = [...otp];
      pasted.split("").forEach((char, i) => {
        if (i < 6) newOtp[i] = char;
      });
      setOtp(newOtp);
      const lastIndex = pasted.length - 1;
      if (inputRefs.current[lastIndex]) {
        inputRefs.current[lastIndex]?.focus();
      }
    }
  };"""

new_paste = """  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const pasted = pastedText.replace(/\D/g, "").slice(0, 6);
    if (pasted.length > 0) {
      const newOtp = [...otp];
      pasted.split("").forEach((char, i) => {
        if (i < 6) newOtp[i] = char;
      });
      setOtp(newOtp);
      const lastIndex = Math.min(pasted.length, 5); // Focus the next empty, or last
      if (inputRefs.current[lastIndex]) {
        inputRefs.current[lastIndex]?.focus();
      }
    }
  };"""

c = c.replace(old_paste, new_paste)
with open("pages/auth/verify-otp.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Updated verify-otp.tsx")
