export class ApiError extends Error {}

async function request(path, options) {
  const res = await fetch(path, options);
  let body = null;
  try {
    body = await res.json();
  } catch (err) {
    body = null;
  }
  if (!res.ok) {
    const message = (body && (body.detail || body.error)) || `Request failed (${res.status})`;
    throw new ApiError(message);
  }
  return body;
}

export function getHealth() {
  return request("/api/health");
}

export function probeUrl(url) {
  return request("/api/probe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export function getSettings() {
  return request("/api/settings");
}

export function saveSettings(output_dir) {
  return request("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ output_dir }),
  });
}

export function enqueueJob(payload) {
  return request("/api/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getQueue() {
  return request("/api/queue");
}

export function cancelJob(jobId) {
  return request(`/api/queue/${jobId}`, { method: "DELETE" });
}
