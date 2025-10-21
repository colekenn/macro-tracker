
const BASE = process.env.REACT_APP_API_URL || "https://render-macro.onrender.com";

export async function apiFetch(path, opts = {}) {
  const url = `${BASE}${path}`;
  const response = await fetch(url, opts);
  return response;
}

export default { BASE, apiFetch };
