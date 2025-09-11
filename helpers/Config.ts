import Cookies from "js-cookie";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API;

const fetchAuthToken = () => {
  return Cookies.get("authToken") || null;
};

export const apiRequest = async (
  endpoint: string,
  method = "GET",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any = null
) => {
  const token = fetchAuthToken();
  if (!token) throw new Error("No authentication token found");

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

  // handle expired/invalid token
  if (response.status === 401 || response.status === 403) {
    if (typeof window !== "undefined") {
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

