const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001";

type ApiOptions = RequestInit & {
  token?: string | null;
};

export const apiFetch = async <T>(path: string, options: ApiOptions = {}): Promise<T> => {
  const { token, headers, ...rest } = options;
  const mergedHeaders = new Headers(headers ?? {});
  mergedHeaders.set("Accept", "application/json");
  if (!(rest.body instanceof FormData)) {
    mergedHeaders.set("Content-Type", "application/json");
  }
  if (token) {
    mergedHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: mergedHeaders,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => {
    throw new Error("Unexpected response from server");
  });

  if (!response.ok) {
    const detail = data?.detail ?? "Request failed";
    throw new Error(typeof detail === "string" ? detail : "Request failed");
  }

  return data as T;
};
