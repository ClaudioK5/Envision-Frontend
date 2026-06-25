import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { FreeAnalysesBanner } from "../components/subscription/FreeAnalysesBanner";
import { UpgradeEnvisionModal } from "../components/subscription/UpgradeEnvisionModal";
import { UploadIcon, VideoIcon } from "../components/Icons";
import {
  analyzeVideoStream,
  AnalyzeVideoError,
  formatAnalyzeErrorStep,
  formatFileSize,
  PA_MAX_BYTES,
  R2_MAX_BYTES,
  validateVideoFile,
} from "../services/analyzeVideo";
import { useEnvisionBilling } from "../subscription/useEnvisionBilling";

type FlowPhase = "form" | "loading" | "streaming" | "success" | "error";

export function EnvisionPage() {
  const { isAuthenticated, requireAuth, refreshUserProfile } = useAuth();
  const billing = useEnvisionBilling();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultBodyRef = useRef<HTMLDivElement>(null);
  const questionId = useId();
  const uploadId = useId();
  const abortRef = useRef<AbortController | null>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<FlowPhase>("form");
  const [loadingMessage, setLoadingMessage] = useState("Uploading your video…");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorStep, setErrorStep] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const canSubmit =
    videoFile !== null && question.trim().length > 0 && phase === "form";

  useEffect(() => {
    if (!videoFile) {
      setThumbnailUrl(null);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setThumbnailUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (phase !== "streaming" || !resultBodyRef.current) return;
    resultBodyRef.current.scrollTop = resultBodyRef.current.scrollHeight;
  }, [phase, result]);

  const clearVideo = useCallback(() => {
    setVideoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const applyVideoFile = useCallback((file: File | null) => {
    if (!file) return;
    const validationError = validateVideoFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      setPhase("error");
      return;
    }
    setVideoFile(file);
    setErrorMessage(null);
    setErrorStep(null);
    if (phase === "error") setPhase("form");
  }, [phase]);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    applyVideoFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    applyVideoFile(file);
  };

  const runAnalysis = useCallback(async () => {
    if (!videoFile) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("loading");
    setLoadingMessage("Uploading your video…");
    setUploadProgress(0);
    setResult("");
    setErrorMessage(null);
    setErrorStep(null);

    try {
      const response = await analyzeVideoStream(
        videoFile,
        question,
        {
          onUploadProgress: (ratio) => {
            const pct = Math.min(100, Math.round(ratio * 100));
            setUploadProgress(pct);
            if (pct >= 100) {
              setLoadingMessage("Watching your video…");
            } else {
              setLoadingMessage(`Uploading your video… ${pct}%`);
            }
          },
          onStatus: (message) => {
            setLoadingMessage(message);
            setPhase((current) => (current === "loading" ? "streaming" : current));
          },
          onChunk: (_chunk, fullText) => {
            setPhase("streaming");
            setResult(fullText);
          },
        },
        controller.signal,
      );

      setResult(response.answer);
      setPhase("success");
      void refreshUserProfile({ force: true });
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof AnalyzeVideoError && e.upgradeRequired) {
        setUpgradeModalOpen(true);
        void refreshUserProfile({ force: true });
        setPhase("form");
        return;
      }
      const msg =
        e instanceof AnalyzeVideoError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Something went wrong. Please try again.";
      setErrorMessage(msg);
      setErrorStep(e instanceof AnalyzeVideoError ? formatAnalyzeErrorStep(e.step) : null);
      setPhase("error");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [question, refreshUserProfile, videoFile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile || !question.trim()) return;

    if (billing.upgradeRequired) {
      setUpgradeModalOpen(true);
      return;
    }

    void requireAuth(
      () => {
        void runAnalysis();
      },
      {
        modalTitle: "Sign in to analyze your video",
        modalSubtitle: "Connect with Google to upload and ask questions about your video.",
      },
    );
  };

  const resetForm = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearVideo();
    setQuestion("");
    setResult(null);
    setUploadProgress(0);
    setErrorMessage(null);
    setErrorStep(null);
    setPhase("form");
  };

  const retry = () => {
    setErrorMessage(null);
    setErrorStep(null);
    setPhase("form");
  };

  if (phase === "loading") {
    return (
      <div className="flow-overlay" role="status" aria-live="polite">
        <div className="flow-overlay__inner flow-overlay__inner--wide">
          <div className="flow-overlay__spinner" aria-hidden />
          <p className="flow-overlay__message">{loadingMessage}</p>
          <div
            className="flow-overlay__progress"
            role="progressbar"
            aria-valuenow={uploadProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
          >
            <div
              className="flow-overlay__progress-fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if ((phase === "streaming" || phase === "success") && result !== null) {
    const isStreaming = phase === "streaming";
    return (
      <section className="envision-page envision-page--result" aria-live="polite">
        <div className="content-card content-card--result">
          <p className="result-kicker">
            {isStreaming ? "Analyzing your video" : "Analysis complete"}
          </p>
          <h2 className="result-title">
            {isStreaming ? "Envision is writing…" : "Here's what Envision found"}
          </h2>
          {isStreaming ? (
            <p className="result-status">{loadingMessage}</p>
          ) : null}

          <div className="result-layout">
            <div className="result-layout__main">
              <div
                ref={resultBodyRef}
                className={`result-body ${isStreaming ? "result-body--streaming" : ""}`}
              >
                {result}
              </div>
              {!isStreaming ? (
                <button type="button" className="btn btn--primary" onClick={resetForm}>
                  Analyze another video
                </button>
              ) : (
                <p className="envision-form__footer-hint">
                  Answer streams in as it is generated.
                </p>
              )}
            </div>

            {thumbnailUrl ? (
              <aside className="result-layout__media" aria-label="Your video">
                <div className="result-video-panel">
                  <video
                    className="result-video"
                    src={thumbnailUrl}
                    controls
                    playsInline
                    preload="metadata"
                  />
                  {videoFile ? (
                    <div className="result-video__meta">
                      <p className="result-video__filename">{videoFile.name}</p>
                      <p className="result-video__size">{formatFileSize(videoFile.size)}</p>
                    </div>
                  ) : null}
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="envision-page">
      <UpgradeEnvisionModal open={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} />
      <div className="content-card">
        <FreeAnalysesBanner />
        <div className="envision-page__hero">
          <h1 className="envision-page__title">
            AI that watches your videos and answers your questions.
          </h1>
          <p className="envision-page__subtitle">
            Upload a video and ask what you want to know about it
          </p>
        </div>

        <form className="envision-form" onSubmit={handleSubmit} noValidate>
          <div className="envision-form__field">
            <label className="visually-hidden" htmlFor={uploadId}>
              Video file
            </label>
            <div
              className={`upload-zone ${dragOver ? "upload-zone--drag" : ""} ${videoFile ? "upload-zone--has-file" : ""}`}
              role="button"
              tabIndex={0}
              aria-label="Upload a video file. Drag and drop or press Enter to browse."
              aria-describedby="upload-hint"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                id={uploadId}
                type="file"
                className="upload-zone__input"
                accept="video/mp4,video/quicktime,video/webm,video/*,.mp4,.mov,.webm"
                onChange={onFileInputChange}
              />

              {!videoFile ? (
                <div className="upload-zone__empty">
                  <UploadIcon className="upload-zone__icon" />
                  <p className="upload-zone__title">Drop your video here</p>
                  <p className="upload-zone__sub">or click to browse</p>
                  <button
                    type="button"
                    className="btn btn--secondary upload-zone__browse"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose video
                  </button>
                </div>
              ) : (
                <div className="upload-zone__preview">
                  {thumbnailUrl ? (
                    <video
                      className="upload-zone__thumb"
                      src={thumbnailUrl}
                      muted
                      playsInline
                      preload="metadata"
                      aria-hidden
                    />
                  ) : (
                    <div className="upload-zone__thumb-placeholder">
                      <VideoIcon />
                    </div>
                  )}
                  <div className="upload-zone__meta">
                    <p className="upload-zone__filename">{videoFile.name}</p>
                    <p className="upload-zone__size">{formatFileSize(videoFile.size)}</p>
                    <button
                      type="button"
                      className="upload-zone__remove"
                      onClick={clearVideo}
                    >
                      Remove video
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p id="upload-hint" className="envision-form__hint">
              MP4, MOV, or WebM · up to {formatFileSize(PA_MAX_BYTES)} direct,{" "}
              {formatFileSize(R2_MAX_BYTES)} via cloud
            </p>
          </div>

          <div className="envision-form__field">
            <label className="envision-form__label" htmlFor={questionId}>
              Your question
            </label>
            <textarea
              id={questionId}
              className="envision-form__textarea"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What do you want to know about this video? (e.g. Summarize the main points, identify key moments, explain what happens at 2:30…)"
              rows={4}
              required
            />
          </div>

          {phase === "error" && errorMessage ? (
            <div className="envision-form__error" role="alert">
              {errorStep ? (
                <p className="envision-form__error-step">Failed during: {errorStep}</p>
              ) : null}
              <p>{errorMessage}</p>
              <button type="button" className="btn btn--secondary" onClick={retry}>
                Try again
              </button>
            </div>
          ) : null}

          <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
            Ask Envision
          </button>

          <p className="envision-form__footer-hint">
            {isAuthenticated
              ? "Your video will be sent securely for analysis."
              : "Sign in with Google to analyze your video."}
          </p>
        </form>

        <p className="envision-page__attribution">
          Powered by{" "}
          <strong>Alibaba Qwen 3.5 Omni Plus</strong>
          {" — "}a state-of-the-art multimodal AI model that can understand videos, audio,
          and answer natural language questions about their content.
        </p>
      </div>
    </section>
  );
}
