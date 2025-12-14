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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

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
    options.body = JSON.stringify(body);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, options);

    if (response.status === 401 || response.status === 403) {
      if (typeof window !== "undefined" && requiresAuth) {
        window.location.href = "/auth/login";
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
    // Catch CORS errors, network errors, etc.
    const isCorsError = error.message?.includes('CORS') || 
                       error.message?.includes('Failed to fetch') ||
                       error.name === 'TypeError' ||
                       !error.response;
    
    if (isCorsError) {
      console.error('🚫 CORS or Network Error:', {
        endpoint,
        method,
        url,
        error: error.message,
        name: error.name,
        stack: error.stack,
      });
      throw new Error(`CORS/Network Error: Unable to fetch ${endpoint}. Check backend CORS configuration. Original error: ${error.message}`);
    }
    
    // Re-throw other errors
    console.error('❌ API Request Error:', {
      endpoint,
      method,
      url,
      error: error.message,
    });
    throw error;
  }
};
