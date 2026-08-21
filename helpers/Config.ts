import Cookies from "js-cookie";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API;

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
    if (!token) throw new Error("No authentication token found");
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

    if (response.status === 401 || response.status === 403) {
      if (typeof window !== "undefined" && requiresAuth) {
        // Clear stale token and redirect to login with redirect param
        Cookies.remove("authToken", { path: "/" });
        const currentPath = window.location.pathname;
        window.location.href = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
      }
      throw new Error("Unauthorized: Redirecting to login");
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
