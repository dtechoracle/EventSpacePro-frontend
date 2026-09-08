import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useRouter } from "next/router";
import Preloader from "./(components)/Preloader";
import { instrumentSans } from "@/helpers/fonts";

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));
  const [loading, setLoading] = useState(false);
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
    if (typeof window === "undefined") return;

    const handleOffline = () => {
      toast.error("No internet connection", { id: "offline", duration: Infinity });
    };
    const handleOnline = () => {
      toast.dismiss("offline");
      toast.success("Back online", { id: "online" });
    };

    if (!navigator.onLine) handleOffline();

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className={instrumentSans.className}>
        {loading && <Preloader />}
        <Toaster
          position="top-center"
          reverseOrder={false}
          toastOptions={{
            style: { marginTop: '80px' },
          }}
        />
        <Component {...pageProps} />
      </div>
    </QueryClientProvider>
  );
}


