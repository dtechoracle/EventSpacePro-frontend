import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useRouter } from "next/router";
import Preloader from "./(components)/Preloader";
import { instrumentSans } from "@/helpers/fonts";
import { useProjectStore } from "@/store/projectStore";

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const hasUnsavedChanges = useProjectStore((s) => s.hasUnsavedChanges);
  const prevHasUnsavedRef = useRef(hasUnsavedChanges);

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

  // No internet toast
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOffline = () => {
      toast.error("No internet connection", { id: "offline", duration: Infinity });
    };
    const handleOnline = () => {
      toast.dismiss("offline");
      toast.success("Back online", { id: "online" });
    };

    // Initial check
    if (!navigator.onLine) handleOffline();

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Unsaved changes toast + navigation guard
  useEffect(() => {
    // Show once when transitioning false -> true
    if (hasUnsavedChanges && !prevHasUnsavedRef.current) {
      toast("You have unsaved changes", { id: "unsaved", duration: 4000 });
    }
    if (!hasUnsavedChanges && prevHasUnsavedRef.current) {
      toast.dismiss("unsaved");
    }
    prevHasUnsavedRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      if (hasUnsavedChanges) {
        toast("You have unsaved changes", { id: "unsaved-route" });
      }
    };
    router.events.on("routeChangeStart", handleRouteChangeStart);
    return () => router.events.off("routeChangeStart", handleRouteChangeStart);
  }, [hasUnsavedChanges, router]);

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


