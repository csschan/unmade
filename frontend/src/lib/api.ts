const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "Request failed");
  }
  return res.json();
}

// --- Discover (Business) ---

export async function createProject(
  userId: string,
  question: string,
  budgetUsd: number
) {
  return request(`/projects?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify({ question, budget_usd: budgetUsd }),
  });
}

export async function getProject(projectId: string) {
  return request(`/projects/${projectId}`);
}

export async function fundProject(projectId: string) {
  return request(`/projects/${projectId}/fund`, { method: "POST" });
}

export async function captureFunding(projectId: string) {
  return request(`/projects/${projectId}/fund/capture`, { method: "POST" });
}

export async function getProduct(projectId: string) {
  return request(`/projects/${projectId}/product`);
}

export async function triggerFusion(projectId: string) {
  return request(`/projects/${projectId}/fuse`, { method: "POST" });
}

export async function purchaseProduct(projectId: string) {
  return request(`/projects/${projectId}/purchase`, { method: "POST" });
}

// --- Earn (Contributor) ---

export async function listTasks(status = "open") {
  return request(`/tasks?status=${status}`);
}

export async function getTask(taskId: string) {
  return request(`/tasks/${taskId}`);
}

export async function submitObservation(
  taskId: string,
  userId: string,
  content: string,
  evidenceUrl?: string
) {
  return request(`/tasks/${taskId}/submit?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify({ content, evidence_url: evidenceUrl }),
  });
}

export async function mySubmissions(userId: string) {
  return request(`/tasks/me/submissions?user_id=${userId}`);
}

// --- Auth ---

export async function register(
  email: string,
  password: string,
  role: string = "both"
) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
}

export async function login(email: string, password: string) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
