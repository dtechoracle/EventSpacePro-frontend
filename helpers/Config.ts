import Cookies from "js-cookie";
import toast from "react-hot-toast";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API;

let isRedirectingToLogin = false;

// Decode the JWT expiry client-side so an expired session is caught BEFORE a
// request is even sent. Without this, an expired token only surfaces when the
// backend rejects it (or worse, misreports the failure as a generic error).
const decodeTokenExp = (token: string): number | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const parsed = JSON.parse(atob(padded));
    return typeof parsed.exp === "number" ? parsed.exp : null;
  } catch {
    return null;
  }
};

// Single exit path for dead sessions: toast, clear the cookie, and send the
// user to login with a redirect back to where they were. Callers get a thrown
// error so save/auto-save flows surface it instead of failing silently.
const handleSessionExpired = (detail: string, redirect: boolean): never => {
  if (typeof window !== "undefined" && redirect && !isRedirectingToLogin) {
    isRedirectingToLogin = true;
    console.error("🔒 Session expired:", detail);
    toast.error("Session expired. Redirecting to login...", { duration: 3000 });
    Cookies.remove("authToken", { path: "/" });
    const returnTo = window.location.pathname + window.location.search;
    setTimeout(() => {
      window.location.href = `/auth/login?redirect=${encodeURIComponent(returnTo)}`;
    }, 2000);
  }
  throw new Error("Unauthorized (401): Session expired");
};

const fetchAuthToken = () => {
  return Cookies.get("authToken") || null;
};

export const apiRequest = async (
  endpoint: string,
  method = "GET",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any = null,
  requiresAuth = true
) => {
  const token = fetchAuthToken();

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = {};

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  // Only add Authorization if auth is required
  if (requiresAuth) {
    if (!token) {
      console.error("🔒 No authentication token found for:", endpoint);
      if (!isRedirectingToLogin) {
        isRedirectingToLogin = true;
        toast.error("No session found. Redirecting to login...", { duration: 3000 });
        Cookies.remove("authToken", { path: "/" });
        setTimeout(() => {
          window.location.href = "/auth/login";
        }, 2000);
      }
      throw new Error("No authentication token found");
    }
    // Proactive expiry check (skip on auth pages to avoid redirect loops).
    // The backend 401 below remains as the fallback for non-JWT/revoked tokens.
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth/")) {
      const exp = decodeTokenExp(token);
      if (exp !== null && exp * 1000 <= Date.now()) {
        handleSessionExpired(`token expired at ${new Date(exp * 1000).toISOString()} (${endpoint})`, requiresAuth);
      }
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, options);

    // Check for EMAIL_NOT_VERIFIED in response body (only for authenticated endpoints)
    // Login/signup pages handle this themselves in their mutation handlers
    if (requiresAuth) {
      try {
        const clonedResponse = response.clone();
        const body = await clonedResponse.json();
        if (body?.code === "EMAIL_NOT_VERIFIED" || body?.data?.code === "EMAIL_NOT_VERIFIED") {
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth/verify-email")) {
            const storedEmail = localStorage.getItem("email") || "";
            toast.error("Please verify your email first", { duration: 3000 });
            setTimeout(() => {
              window.location.href = `/auth/verify-email${storedEmail ? `?email=${encodeURIComponent(storedEmail)}` : ""}`;
            }, 1500);
          }
          throw new Error("EMAIL_NOT_VERIFIED: Please verify your email address");
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("EMAIL_NOT_VERIFIED")) throw e;
      }
    }

    if (response.status === 401) {
      handleSessionExpired(`${endpoint} responded 401`, requiresAuth);
    }

    if (response.status === 403) {
      console.error(`🚫 Access denied (403):`, { endpoint, url });
      if (requiresAuth) {
        throw new Error(`Access denied (403): You don't have permission for this resource`);
      }
      // For non-auth endpoints (like login), return the error data as-is
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Access denied (403)`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Always log errors to help debug CORS/network issues
      console.error('❌ API Request Failed:', {
        endpoint,
        method,
        status: response.status,
        statusText: response.statusText,
        error: errorData.message || errorData,
        url,
      });

      throw new Error(errorData.message || `Request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ API Request Success:', { endpoint, method, url });
    return data;
  } catch (error: any) {
    // Only treat as CORS/network error if it's an actual fetch failure
    // (TypeError from fetch rejection or message containing network-level keywords)
    const isCorsError = (error.name === 'TypeError' && !error.message?.includes('Unauthorized')) ||
                       error.message?.includes('Failed to fetch') ||
                       error.message?.includes('NetworkError') ||
                       error.message?.includes('Load failed');
    
    if (isCorsError) {
      console.error('🚫 CORS or Network Error:', {
        endpoint,
        method,
        url,
        error: error.message,
        name: error.name,
        stack: error.stack,
      });
      throw new Error(`Network error: Unable to reach the server. Check your connection.`);
    }
    
    // Re-throw all other errors as-is (including validation errors like "Email already in use")
    console.error('❌ API Request Error:', {
      endpoint,
      method,
      url,
      error: error.message,
    });
    throw error;
  }
};
