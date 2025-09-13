import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { useRouter } from "next/router";
import Preloader from "./(components)/Preloader";
import MobileBlocker from "./(components)/MoblileBlocker";

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleStart = () => setLoading(true);
    const handleComplete = (url: string) => {
      setLoading(false);
      sessionStorage.setItem("lastRoute", url);
    };

    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleComplete);
    router.events.on("routeChangeError", handleComplete);

    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleComplete);
      router.events.off("routeChangeError", handleComplete);
    };
  }, [router]);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768); // Tailwind's "md" breakpoint
    };

    checkIsMobile(); // run once at mount
    window.addEventListener("resize", checkIsMobile);

    return () => {
      window.removeEventListener("resize", checkIsMobile);
    };
  }, []);

  const isDashboardRoute = router.pathname.startsWith("/dashboard");

  return (
    <QueryClientProvider client={queryClient}>
      {loading && <Preloader />}
      <Toaster position="top-right" reverseOrder={false} />

      {isMobile && isDashboardRoute ? (
        <MobileBlocker />
      ) : (
        <Component {...pageProps} />
      )}
    </QueryClientProvider>
  );
}

