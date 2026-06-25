import {
  getEnvisionAnalyzeStreamUrl,
  getEnvisionAnalyzeWebhookUrl,
  getEnvisionR2UploadUrl,
  getEnvisionR2VerifyUrl,
} from "../auth/apiConfig";
import { getPulseJwt } from "../auth/pulseClient";

export class AnalyzeVideoError extends Error {
  readonly status?: number;
  /** Human-readable pipeline stage, e.g. "presign", "cloud upload", "analysis". */
  readonly step?: string;
  readonly upgradeRequired?: boolean;

  constructor(message: string, status?: number, step?: string, upgradeRequired = false) {
    super(message);
    this.name = "AnalyzeVideoError";
    this.status = status;
    this.step = step;
    this.upgradeRequired = upgradeRequired;
  }
}

export type AnalyzeVideoResult = {
  answer: string;
  summary?: string;
  videoUrl?: string;
};

export type AnalyzeStreamCallbacks = {
  onUploadProgress?: (ratio: number) => void;
  onStatus?: (message: string) => void;
  onChunk?: (chunk: string, fullText: string) => void;
};

/** Direct upload to PythonAnywhere (stays under PA ~100 MB limit). */
export const PA_MAX_BYTES = 95 * 1024 * 1024;
/** Large videos go to Cloudflare R2 via presigned PUT. */
export const R2_MAX_BYTES = 500 * 1024 * 1024;
export const MAX_VIDEO_BYTES = R2_MAX_BYTES;

const STREAM_TIMEOUT_MS = 300_000;

type SseEvent =
  | { type: "status"; message: string; video_url?: string }
  | { type: "chunk"; text: string }
  | { type: "done"; video_url: string }
  | { type: "error"; error: string };

type R2UploadUrlResponse = {
  upload_url: string;
  object_key: string;
  content_type: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateVideoFile(file: File): string | null {
  const allowedTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
  const isVideo =
    file.type.startsWith("video/") ||
    allowedTypes.includes(file.type) ||
    /\.(mp4|mov|webm)$/i.test(file.name);

  if (!isVideo) {
    return "Please choose an MP4, MOV, or WebM video.";
  }
  if (file.size > R2_MAX_BYTES) {
    return `Video must be under ${formatFileSize(R2_MAX_BYTES)} (selected: ${formatFileSize(file.size)}).`;
  }
  return null;
}

function getAuthToken(): string | null {
  return getPulseJwt();
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function parseSseBuffer(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";

  for (const block of blocks) {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        events.push(JSON.parse(line.slice(6)) as SseEvent);
      } catch {
        // ignore malformed chunks
      }
    }
  }

  return { events, rest };
}

function appendStreamText(state: { fullText: string }, chunk: string): string {
  if (!chunk) return state.fullText;

  if (state.fullText && chunk.startsWith(state.fullText)) {
    state.fullText = chunk;
    return state.fullText;
  }

  if (state.fullText.endsWith(chunk)) {
    return state.fullText;
  }

  state.fullText += chunk;
  return state.fullText;
}

function handleSseEvents(
  events: SseEvent[],
  callbacks: AnalyzeStreamCallbacks,
  state: { fullText: string; videoUrl?: string },
): void {
  for (const event of events) {
    if (event.type === "status") {
      callbacks.onStatus?.(event.message);
      if (event.video_url) state.videoUrl = event.video_url;
      continue;
    }
    if (event.type === "chunk" && event.text) {
      const fullText = appendStreamText(state, event.text);
      callbacks.onChunk?.(event.text, fullText);
      continue;
    }
    if (event.type === "done") {
      state.videoUrl = event.video_url;
      continue;
    }
    if (event.type === "error") {
      throw new AnalyzeVideoError(event.error);
    }
  }
}

function drainSseBuffer(
  pending: string,
  callbacks: AnalyzeStreamCallbacks,
  state: { fullText: string; videoUrl?: string },
  flush = false,
): string {
  const source = flush && pending && !pending.endsWith("\n\n") ? `${pending}\n\n` : pending;
  const parsed = parseSseBuffer(source);
  handleSseEvents(parsed.events, callbacks, state);
  return parsed.rest;
}

function parseS3ErrorBody(body: string): { code?: string; message?: string } {
  if (!body.trim()) return {};
  const codeMatch = body.match(/<Code>([^<]+)<\/Code>/i);
  const messageMatch = body.match(/<Message>([^<]+)<\/Message>/i);
  return {
    code: codeMatch?.[1]?.trim(),
    message: messageMatch?.[1]?.trim(),
  };
}

function formatUploadProgress(ratio: number): string {
  const pct = Math.min(100, Math.round(ratio * 100));
  return pct > 0 ? ` (reached ${pct}%)` : "";
}

function buildR2PutFailureMessage(
  status: number,
  responseText: string,
  contentType: string,
  uploadRatio: number,
): string {
  const progress = formatUploadProgress(uploadRatio);
  const s3 = parseS3ErrorBody(responseText);

  if (status === 0) {
    return `Cloud upload was blocked${progress}. This is usually an R2 CORS issue — allow PUT from http://localhost:5174 on envisionbucket.`;
  }

  if (s3.code || s3.message) {
    const detail = [s3.code, s3.message].filter(Boolean).join(": ");
    let hint = "";
    if (status === 403 && s3.code === "SignatureDoesNotMatch") {
      hint = " Content-Type on the upload must match what the server presigned.";
    }
    return `Cloud upload rejected (HTTP ${status})${progress}: ${detail}.${hint}`;
  }

  const snippet = responseText.trim().slice(0, 200);
  if (snippet) {
    return `Cloud upload failed (HTTP ${status})${progress}: ${snippet}`;
  }

  if (status === 403) {
    return `Cloud upload forbidden (HTTP 403)${progress}. Check R2 credentials and that Content-Type is "${contentType}".`;
  }

  return `Cloud upload failed (HTTP ${status})${progress}.`;
}

function logUploadFailure(
  step: string,
  details: Record<string, unknown>,
): void {
  console.error(`[Envision] Failed during ${step}`, details);
}

function xhrPutWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let uploadRatio = 0;

    const fail = (message: string, status?: number) => {
      logUploadFailure("cloud upload", {
        status: status ?? xhr.status,
        uploadRatio,
        contentType,
        host: (() => {
          try {
            return new URL(url).host;
          } catch {
            return "unknown";
          }
        })(),
        responsePreview: xhr.responseText?.slice(0, 300),
      });
      reject(new AnalyzeVideoError(message, status ?? xhr.status, "cloud upload"));
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        uploadRatio = event.loaded / event.total;
        onProgress?.(uploadRatio);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      fail(buildR2PutFailureMessage(xhr.status, xhr.responseText, contentType, uploadRatio), xhr.status);
    };

    xhr.onerror = () => {
      const progress = formatUploadProgress(uploadRatio);
      fail(
        `Connection lost while uploading to Cloudflare R2${progress}. ` +
          "Check DevTools → Network for the PUT request to r2.cloudflarestorage.com " +
          "(CORS, network drop, or firewall).",
      );
    };

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(file);
  });
}

async function requestR2UploadUrl(file: File): Promise<R2UploadUrlResponse> {
  const uploadUrlEndpoint = getEnvisionR2UploadUrl();
  if (!uploadUrlEndpoint) {
    throw new AnalyzeVideoError(
      "Cloud upload is not configured. Set VITE_ENVISION_ANALYZE_WEBHOOK_URL in .env.local.",
      undefined,
      "presign",
    );
  }

  let res: Response;
  try {
    res = await fetch(uploadUrlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        filename: file.name,
        content_type: file.type || "video/mp4",
        size: file.size,
      }),
    });
  } catch (e) {
    logUploadFailure("presign", { error: e instanceof Error ? e.message : e });
    throw new AnalyzeVideoError(
      `Could not reach the upload server: ${e instanceof Error ? e.message : "network error"}. ` +
        "Check ClaudioK is up and CORS allows localhost:5174.",
      undefined,
      "presign",
    );
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (typeof data.error === "string" && data.error) ||
      `Could not prepare cloud upload (HTTP ${res.status}).`;
    logUploadFailure("presign", { status: res.status, error: msg });
    throw new AnalyzeVideoError(msg, res.status, "presign");
  }

  const upload_url = data.upload_url;
  const object_key = data.object_key;
  const content_type = data.content_type;
  if (
    typeof upload_url !== "string" ||
    typeof object_key !== "string" ||
    typeof content_type !== "string"
  ) {
    throw new AnalyzeVideoError(
      "Invalid response from cloud upload endpoint (missing upload_url, object_key, or content_type).",
      res.status,
      "presign",
    );
  }

  return { upload_url, object_key, content_type };
}

async function verifyR2Object(objectKey: string, expectedSize: number): Promise<void> {
  const verifyUrl = getEnvisionR2VerifyUrl();
  if (!verifyUrl) {
    throw new AnalyzeVideoError(
      "Cloud verify URL is not configured. Set VITE_ENVISION_ANALYZE_WEBHOOK_URL in .env.local.",
      undefined,
      "verify",
    );
  }

  let res: Response;
  try {
    res = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        object_key: objectKey,
        expected_size: expectedSize,
      }),
    });
  } catch (e) {
    logUploadFailure("verify", { objectKey, error: e instanceof Error ? e.message : e });
    throw new AnalyzeVideoError(
      `Could not verify Cloudflare upload: ${e instanceof Error ? e.message : "network error"}.`,
      undefined,
      "verify",
    );
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (typeof data.error === "string" && data.error) ||
      `Cloudflare R2 verification failed (HTTP ${res.status}).`;
    logUploadFailure("verify", { objectKey, status: res.status, error: msg, data });
    throw new AnalyzeVideoError(msg, res.status, "verify");
  }

  if (data.ok !== true) {
    const msg =
      (typeof data.error === "string" && data.error) ||
      "Cloudflare R2 verification failed.";
    throw new AnalyzeVideoError(msg, res.status, "verify");
  }
}

async function uploadVideoToR2(
  file: File,
  callbacks: AnalyzeStreamCallbacks,
): Promise<string> {
  callbacks.onStatus?.("Preparing cloud upload…");
  const { upload_url, object_key, content_type } = await requestR2UploadUrl(file);

  callbacks.onStatus?.("Uploading your video to cloud storage…");
  await xhrPutWithProgress(upload_url, file, content_type, callbacks.onUploadProgress);

  callbacks.onStatus?.("Verifying cloud upload…");
  await verifyR2Object(object_key, file.size);

  return object_key;
}

function streamAnalyzeRequest(
  body: FormData,
  callbacks: AnalyzeStreamCallbacks,
  signal?: AbortSignal,
  trackUpload = false,
): Promise<AnalyzeVideoResult> {
  const streamUrl = getEnvisionAnalyzeStreamUrl();
  if (!streamUrl) {
    return Promise.reject(
      new AnalyzeVideoError(
        "Analyze stream URL is not configured. Set VITE_ENVISION_ANALYZE_WEBHOOK_URL in .env.local.",
      ),
    );
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let receivedLength = 0;
    let ssePending = "";
    const state = { fullText: "", videoUrl: undefined as string | undefined };
    let settled = false;

    const processStreamDelta = (flush = false) => {
      try {
        ssePending = drainSseBuffer(ssePending, callbacks, state, flush);
      } catch (e) {
        cleanup();
        fail(
          e instanceof AnalyzeVideoError
            ? e
            : new AnalyzeVideoError(
                e instanceof Error ? e.message : "Stream parsing failed.",
              ),
        );
      }
    };

    const ingestResponseText = (flush = false) => {
      const full = xhr.responseText;
      const delta = full.slice(receivedLength);
      receivedLength = full.length;
      if (!delta && !flush) return;
      if (delta) ssePending += delta;
      processStreamDelta(flush);
    };

    const fail = (error: AnalyzeVideoError) => {
      if (settled) return;
      settled = true;
      xhr.abort();
      if (!error.step) {
        reject(new AnalyzeVideoError(error.message, error.status, "analysis"));
        return;
      }
      reject(error);
    };

    const succeed = () => {
      if (settled) return;
      if (!state.fullText.trim()) {
        fail(new AnalyzeVideoError("Analysis completed but returned no text."));
        return;
      }
      settled = true;
      resolve({ answer: state.fullText.trim(), videoUrl: state.videoUrl });
    };

    const onAbort = () => {
      fail(new AnalyzeVideoError("Analysis timed out. Please try again."));
    };

    const timeout = window.setTimeout(onAbort, STREAM_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", onSignalAbort);
    };

    const onSignalAbort = () => {
      cleanup();
      fail(new AnalyzeVideoError("Analysis cancelled."));
    };

    if (signal?.aborted) {
      onSignalAbort();
      return;
    }
    signal?.addEventListener("abort", onSignalAbort);

    if (trackUpload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          callbacks.onUploadProgress?.(event.loaded / event.total);
        }
      };
    }

    xhr.onprogress = () => {
      ingestResponseText(false);
    };

    xhr.onload = () => {
      cleanup();

      if (xhr.status < 200 || xhr.status >= 300) {
        let message = `Analysis request failed (HTTP ${xhr.status}).`;
        let upgradeRequired = xhr.status === 402;
        try {
          const parsed = JSON.parse(xhr.responseText) as {
            error?: string;
            upgrade_required?: boolean;
          };
          if (parsed.error) message = parsed.error;
          if (parsed.upgrade_required) upgradeRequired = true;
        } catch {
          const snippet = xhr.responseText.trim().slice(0, 200);
          if (snippet) message = `${message} ${snippet}`;
        }
        logUploadFailure("analysis", { status: xhr.status, message });
        fail(new AnalyzeVideoError(message, xhr.status, "analysis", upgradeRequired));
        return;
      }

      ingestResponseText(true);
      succeed();
    };

    xhr.onerror = () => {
      cleanup();
      logUploadFailure("analysis", { reason: "network error" });
      fail(
        new AnalyzeVideoError(
          "Network error while starting analysis. Check ClaudioK /envision/analyze-stream is reachable.",
          undefined,
          "analysis",
        ),
      );
    };

    xhr.onabort = () => {
      if (!settled) {
        cleanup();
        fail(new AnalyzeVideoError("Analysis cancelled."));
      }
    };

    xhr.open("POST", streamUrl);
    xhr.setRequestHeader("Accept", "text/event-stream");
    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    xhr.send(body);
  });
}

function streamAnalyzeWithObjectKey(
  objectKey: string,
  question: string,
  expectedSize: number | undefined,
  callbacks: AnalyzeStreamCallbacks,
  signal?: AbortSignal,
): Promise<AnalyzeVideoResult> {
  const formData = new FormData();
  formData.append("object_key", objectKey);
  formData.append("question", question);
  if (expectedSize && expectedSize > 0) {
    formData.append("expected_size", String(expectedSize));
  }
  callbacks.onStatus?.("Analyzing your video…");
  return streamAnalyzeRequest(formData, callbacks, signal);
}

function streamAnalyzeWithFile(
  file: File,
  question: string,
  callbacks: AnalyzeStreamCallbacks,
  signal?: AbortSignal,
): Promise<AnalyzeVideoResult> {
  const formData = new FormData();
  formData.append("video", file, file.name);
  formData.append("question", question);
  return streamAnalyzeRequest(formData, callbacks, signal, true);
}

/** Stream analysis via SSE — upload progress + live answer text. */
export async function analyzeVideoStream(
  file: File,
  question: string,
  callbacks: AnalyzeStreamCallbacks = {},
  signal?: AbortSignal,
): Promise<AnalyzeVideoResult> {
  const validationError = validateVideoFile(file);
  if (validationError) {
    throw new AnalyzeVideoError(validationError);
  }

  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new AnalyzeVideoError("Please enter a question about your video.");
  }

  if (file.size > PA_MAX_BYTES) {
    const objectKey = await uploadVideoToR2(file, callbacks);
    return streamAnalyzeWithObjectKey(objectKey, trimmedQuestion, file.size, callbacks, signal);
  }

  return streamAnalyzeWithFile(file, trimmedQuestion, callbacks, signal);
}

/** Non-streaming fallback (curl / Postman / legacy). */
export async function analyzeVideo(
  file: File,
  question: string,
): Promise<AnalyzeVideoResult> {
  const webhookUrl = getEnvisionAnalyzeWebhookUrl();
  if (!webhookUrl) {
    throw new AnalyzeVideoError(
      "Analyze webhook is not configured. Set VITE_ENVISION_ANALYZE_WEBHOOK_URL in .env.local.",
    );
  }

  const validationError = validateVideoFile(file);
  if (validationError) {
    throw new AnalyzeVideoError(validationError);
  }

  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new AnalyzeVideoError("Please enter a question about your video.");
  }

  let formData: FormData;
  if (file.size > PA_MAX_BYTES) {
    const objectKey = await uploadVideoToR2(file, {});
    formData = new FormData();
    formData.append("object_key", objectKey);
    formData.append("question", trimmedQuestion);
    formData.append("expected_size", String(file.size));
  } else {
    formData = new FormData();
    formData.append("video", file, file.name);
    formData.append("question", trimmedQuestion);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === "AbortError") {
      throw new AnalyzeVideoError("Analysis timed out. Please try again.");
    }
    throw new AnalyzeVideoError(
      e instanceof Error ? e.message : "Network error while analyzing video.",
    );
  }
  clearTimeout(timeout);

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const msg =
      (typeof data.error === "string" && data.error) ||
      (typeof data.detail === "string" && data.detail) ||
      (typeof data.message === "string" && data.message) ||
      `HTTP ${res.status}`;
    throw new AnalyzeVideoError(msg, res.status);
  }

  const answer = extractAnswer(data);
  const summary =
    typeof data.summary === "string" && data.summary.trim()
      ? data.summary.trim()
      : undefined;
  const videoUrl =
    typeof data.video_url === "string" && data.video_url.trim()
      ? data.video_url.trim()
      : undefined;

  return { answer, summary, videoUrl };
}

function extractAnswer(data: Record<string, unknown>): string {
  const candidates = [
    data.answer,
    data.result,
    data.summary,
    data.response,
    data.text,
    data.message,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "Analysis complete. No detailed answer was returned.";
}

export { formatFileSize };

const STEP_LABELS: Record<string, string> = {
  presign: "Preparing cloud upload",
  "cloud upload": "Uploading to Cloudflare R2",
  verify: "Verifying Cloudflare R2 upload",
  analysis: "Analyzing video",
};

export function formatAnalyzeErrorStep(step?: string): string | null {
  if (!step) return null;
  return STEP_LABELS[step] ?? step;
}
