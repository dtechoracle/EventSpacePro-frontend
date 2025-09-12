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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

  if (response.status === 401 || response.status === 403) {
    if (typeof window !== "undefined" && requiresAuth) {
      window.location.href = "/auth/login";
    }
    throw new Error("Unauthorized: Redirecting to login");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Request failed");
  }

  return response.json();
};

