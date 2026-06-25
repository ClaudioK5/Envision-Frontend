/** Same default as mobile `app.json` → `expo.extra.pulseApiUrl`. */
export const DEFAULT_PULSE_API_URL = "https://klaudioc.pythonanywhere.com";

/** Base URL for Pulse API (no trailing slash). */
export function getPulseApiBaseUrl(): string {
  const fromVite =
    typeof import.meta.env.VITE_PULSE_API_URL === "string"
      ? import.meta.env.VITE_PULSE_API_URL.trim()
      : "";
  const fromNext =
    typeof import.meta.env.NEXT_PUBLIC_PULSE_API_URL === "string"
      ? import.meta.env.NEXT_PUBLIC_PULSE_API_URL.trim()
      : "";
  const raw = fromVite || fromNext || DEFAULT_PULSE_API_URL;
  return raw.replace(/\/$/, "");
}

export function getGoogleWebClientId(): string | null {
  const raw =
    import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID?.trim() ||
    import.meta.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
    "";
  return raw || null;
}

export function getEnvisionAnalyzeWebhookUrl(): string | null {
  const raw = import.meta.env.VITE_ENVISION_ANALYZE_WEBHOOK_URL?.trim() || "";
  return raw || null;
}

/** Streaming SSE endpoint — derived from VITE_ENVISION_ANALYZE_WEBHOOK_URL. */
export function getEnvisionAnalyzeStreamUrl(): string | null {
  const analyzeUrl = getEnvisionAnalyzeWebhookUrl();
  if (!analyzeUrl) return null;
  if (analyzeUrl.endsWith("/analyze")) {
    return `${analyzeUrl}-stream`;
  }
  return `${analyzeUrl.replace(/\/$/, "")}/analyze-stream`;
}

/** Envision API base (e.g. https://ClaudioK.pythonanywhere.com/envision). */
export function getEnvisionApiBaseUrl(): string | null {
  const analyzeUrl = getEnvisionAnalyzeWebhookUrl();
  if (!analyzeUrl) return null;
  if (analyzeUrl.endsWith("/analyze")) {
    return analyzeUrl.slice(0, -"/analyze".length);
  }
  const trimmed = analyzeUrl.replace(/\/$/, "");
  if (trimmed.endsWith("/analyze-stream")) {
    return trimmed.slice(0, -"/analyze-stream".length);
  }
  return trimmed;
}

export function getEnvisionR2UploadUrl(): string | null {
  const base = getEnvisionApiBaseUrl();
  return base ? `${base}/r2/upload-url` : null;
}

export function getEnvisionR2VerifyUrl(): string | null {
  const base = getEnvisionApiBaseUrl();
  return base ? `${base}/r2/verify` : null;
}
