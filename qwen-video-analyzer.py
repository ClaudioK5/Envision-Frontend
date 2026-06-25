"""
Local CLI for testing QWEN video analysis.

Usage:
  set QWEN_API_KEY=sk-...
  python qwen-video-analyzer.py
  python qwen-video-analyzer.py "https://example.com/video.mp4" "Summarize this video"

For uploads from the React app, use the Flask server in pythonanywhere/envision_flask.py.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "pythonanywhere"))

from qwen_client import stream_video_url

DEFAULT_VIDEO_URL = (
    "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241115/cqqkru/1.mp4"
)
DEFAULT_QUESTION = "Analyze this video in detail. Generate the full report."


def main() -> None:
    video_url = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("VIDEO_URL", DEFAULT_VIDEO_URL)
    question = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("VIDEO_QUESTION", DEFAULT_QUESTION)

    full_text = ""
    for chunk in stream_video_url(video_url, question):
        print(chunk, end="", flush=True)
        full_text += chunk

    print("\n\nDONE")
    if not full_text.strip():
        print("No text returned. Check QWEN_API_KEY and that the video URL is publicly reachable.")


if __name__ == "__main__":
    main()
