import Cookies from "js-cookie";
import toast from "react-hot-toast";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API;

let isRedirectingToLogin = false;

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
      if (typeof window !== "undefined" && requiresAuth && !isRedirectingToLogin) {
        isRedirectingToLogin = true;
        console.error(`🔒 Session expired (401):`, { endpoint, url });
        toast.error("Session expired. Redirecting to login...", { duration: 3000 });
        Cookies.remove("authToken", { path: "/" });
        const currentPath = window.location.pathname;
        setTimeout(() => {
          window.location.href = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
        }, 2000);
      }
      throw new Error(`Unauthorized (401): Session expired`);
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
