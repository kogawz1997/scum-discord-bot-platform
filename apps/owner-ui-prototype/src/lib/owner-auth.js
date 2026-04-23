async function parseAuthResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok || payload?.ok === false) {
    return {
      ok: false,
      status: response.status,
      error: payload?.error || response.statusText || "Authentication request failed",
      requiresOtp: payload?.requiresOtp === true,
      data: payload?.data || null,
    };
  }

  return {
    ok: true,
    status: response.status,
    data: payload?.data ?? payload,
  };
}

function cleanAuthValue(value) {
  return String(value || "").trim();
}

function isSafeInternalPath(value) {
  if (!value || typeof value !== "string") return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value === "/login" || value.startsWith("/login?")) return false;
  return true;
}

export async function getOwnerSession(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(options.path || "/owner/api/me", {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  return parseAuthResponse(response);
}

export function buildOwnerLoginRedirect(pathname = "/overview", search = "") {
  const requested = `${pathname || "/overview"}${search || ""}`;
  if (!isSafeInternalPath(requested)) return "/login";
  return `/login?next=${encodeURIComponent(requested)}`;
}

export function resolvePostLoginPath(search = "", fallback = "/overview") {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const next = params.get("next");
  return isSafeInternalPath(next) ? next : fallback;
}

export async function loginOwner(credentials = {}, options = {}) {
  const username = cleanAuthValue(credentials.username);
  const password = String(credentials.password || "");
  const otp = cleanAuthValue(credentials.otp);

  if (!username) {
    return { ok: false, status: 0, error: "Username is required" };
  }
  if (!password) {
    return { ok: false, status: 0, error: "Password is required" };
  }

  const body = { username, password };
  if (otp) body.otp = otp;

  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(options.path || "/owner/api/login", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseAuthResponse(response);
}

export async function logoutOwner(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(options.path || "/owner/api/logout", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  return parseAuthResponse(response);
}
