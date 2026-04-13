const GH_ACCEPT = "application/vnd.github+json";

export type GitHubFileResponse = {
  type: string;
  encoding?: string;
  content?: string;
  sha: string;
  name: string;
  path: string;
};

export type GitHubDirEntry = {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir";
  size?: number;
};

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToUtf8(b64: string): string {
  const clean = b64.replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

export function parseJsonFromGitHubContent(b64: string): unknown {
  let text = base64ToUtf8(b64);
  const startIdx = text.indexOf("{");
  if (startIdx > 0) text = text.slice(startIdx);
  const endIdx = text.lastIndexOf("}");
  if (endIdx !== -1) text = text.slice(0, endIdx + 1);
  return JSON.parse(text);
}

export function ghHeaders(token: string, method?: string): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `token ${token}`,
    Accept: GH_ACCEPT,
  };
  if (method && method !== "GET") h["Content-Type"] = "application/json";
  return h;
}

export async function getRepoFile(
  owner: string,
  repo: string,
  path: string,
  token: string,
): Promise<{ sha: string; text: string } | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const res = await fetch(`${url}?t=${Date.now()}`, {
    headers: ghHeaders(token),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const err = (await res.json()) as { message?: string };
      if (err.message) msg = err.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const json = (await res.json()) as GitHubFileResponse;
  if (json.type !== "file" || !json.content) throw new Error(`${path} is not a file`);
  return { sha: json.sha, text: base64ToUtf8(json.content) };
}

export async function putRepoFile(
  owner: string,
  repo: string,
  path: string,
  token: string,
  text: string,
  sha: string | null,
  message: string,
): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body: Record<string, string> = {
    message,
    content: utf8ToBase64(text),
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: ghHeaders(token, "PUT"),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const err = (await res.json()) as { message?: string };
      if (err.message) msg = err.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const out = (await res.json()) as { content?: { sha?: string }; commit?: { sha?: string } };
  return out.content?.sha ?? out.commit?.sha ?? "";
}

/** PUT file using raw base64 (e.g. image bytes), not UTF-8 text. */
export async function putRepoBinaryBase64(
  owner: string,
  repo: string,
  path: string,
  token: string,
  base64Content: string,
  sha: string | null,
  message: string,
): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body: Record<string, string> = {
    message,
    content: base64Content.replace(/\s/g, ""),
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: ghHeaders(token, "PUT"),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const err = (await res.json()) as { message?: string };
      if (err.message) msg = err.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const out = (await res.json()) as { content?: { sha?: string } };
  return out.content?.sha ?? "";
}

export async function deleteRepoFile(
  owner: string,
  repo: string,
  path: string,
  token: string,
  sha: string,
  message: string,
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: ghHeaders(token, "DELETE"),
    body: JSON.stringify({ message, sha }),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const err = (await res.json()) as { message?: string };
      if (err.message) msg = err.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

export async function listRepoDirectory(
  owner: string,
  repo: string,
  dirPath: string,
  token: string,
): Promise<GitHubDirEntry[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(dirPath)}`;
  const res = await fetch(`${url}?t=${Date.now()}`, { headers: ghHeaders(token), cache: "no-store" });
  if (res.status === 404) return [];
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const err = (await res.json()) as { message?: string };
      if (err.message) msg = err.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const json = (await res.json()) as GitHubDirEntry | GitHubDirEntry[];
  return Array.isArray(json) ? json : [];
}

export async function getFileSha(
  owner: string,
  repo: string,
  path: string,
  token: string,
): Promise<string | null> {
  const f = await getRepoFile(owner, repo, path, token);
  return f?.sha ?? null;
}
