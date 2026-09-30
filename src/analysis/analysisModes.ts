export type AnalysisMode = "general" | "creator" | "podcast";

export type AnalysisPromptAction = {
  id: string;
  label: string;
  hint: string;
  prompt: string;
};

export type AnalysisPromptGroup = {
  id: string;
  label: string;
  actions: AnalysisPromptAction[];
};

export type AnalysisModeOption = {
  id: AnalysisMode;
  label: string;
  hint: string;
  placeholder: string;
  statusMessage: string;
  submitLabel: string;
  resultKicker: string;
  resultTitleStreaming: string;
  resultTitleDone: string;
  promptGroups: AnalysisPromptGroup[];
};

export const ANALYSIS_MODES: AnalysisModeOption[] = [
  {
    id: "general",
    label: "General",
    hint: "Ask anything about the video",
    placeholder:
      "What do you want to know about this video? (e.g. Summarize the main points, identify key moments, explain what happens at 2:30…)",
    statusMessage: "Analyzing your video…",
    submitLabel: "Ask Visorixs",
    resultKicker: "Analysis",
    resultTitleStreaming: "Visorixs is writing…",
    resultTitleDone: "Here's what Visorixs found",
    promptGroups: [],
  },
  {
    id: "creator",
    label: "Creator",
    hint: "Reels & short-form tips",
    placeholder:
      "What should we improve? (e.g. How can I make the hook stronger? Review pacing and the CTA…)",
    statusMessage: "Reviewing your video as a creator strategist…",
    submitLabel: "Ask Visorixs · Creator",
    resultKicker: "Creator Mode",
    resultTitleStreaming: "Visorixs is writing…",
    resultTitleDone: "Here's how to improve this video",
    promptGroups: [
      {
        id: "creator-workflows",
        label: "Creator workflows",
        actions: [
          {
            id: "hook",
            label: "Strengthen the hook",
            hint: "First 1–3 seconds",
            prompt:
              "Review the opening hook of this video. Tell me what is working, what is weak, and exactly how to make the first 1–3 seconds stronger while keeping my style.",
          },
          {
            id: "retention",
            label: "Improve retention",
            hint: "Pacing & dead moments",
            prompt:
              "Find the biggest retention risks in this video (pacing, clarity, payoff, dead moments). Give high-impact edit suggestions tied to specific moments.",
          },
          {
            id: "cta",
            label: "Improve the CTA",
            hint: "Stronger close",
            prompt:
              "Review the ending and CTA. Suggest a clearer, stronger close that fits this video's promise and my personality.",
          },
          {
            id: "full-review",
            label: "Full creator review",
            hint: "Hook to CTA",
            prompt:
              "Give a full Creator Mode review of this video: hook, retention, clarity, delivery, visuals/audio, payoff, and CTA. Only keep high-impact, video-specific tips.",
          },
        ],
      },
    ],
  },
  {
    id: "podcast",
    label: "Podcast",
    hint: "Chapters, clips, quotes",
    placeholder:
      "What do you need from this episode? (e.g. chapters, best clips, quotes, summary…)",
    statusMessage: "Reviewing your episode as a podcast analyst…",
    submitLabel: "Ask Visorixs · Podcast",
    resultKicker: "Podcast Mode",
    resultTitleStreaming: "Visorixs is writing…",
    resultTitleDone: "Here's your podcast production map",
    promptGroups: [
      {
        id: "structure",
        label: "Structure",
        actions: [
          {
            id: "timestamps",
            label: "Find key timestamps",
            hint: "Topic map",
            prompt:
              "Create a timestamped map of the major discussions in this episode. Use meaningful topic changes rather than arbitrary intervals.",
          },
          {
            id: "chapters",
            label: "Generate chapters",
            hint: "Titles + start times",
            prompt:
              "Create a clean chapter structure based on meaningful topic transitions. Give each chapter a concise title and starting timestamp.",
          },
          {
            id: "topics",
            label: "Main topics",
            hint: "Episode outline",
            prompt:
              "List the main topics covered in this episode with timestamps when each topic begins. Keep titles concise and production-ready.",
          },
        ],
      },
      {
        id: "clips-quotes",
        label: "Clips & quotes",
        actions: [
          {
            id: "clips",
            label: "Best clip moments",
            hint: "Short-form ready",
            prompt:
              "Find the strongest standalone moments that could work as short-form clips. For each, provide start/end timestamps, what happens, why it works, and a suggested hook/title.",
          },
          {
            id: "quotes",
            label: "Top quotes",
            hint: "Exact words spoken",
            prompt:
              "Find the strongest directly spoken quotes in the episode. Include speaker and timestamp. Do not paraphrase.",
          },
          {
            id: "repurpose",
            label: "What should I repurpose?",
            hint: "Clips, posts, promos",
            prompt:
              "Identify the parts of this episode most worth repurposing into short-form content, posts, clips, or promotional material. Explain why each moment has value and include timestamps.",
          },
        ],
      },
      {
        id: "insights",
        label: "Insights",
        actions: [
          {
            id: "summary",
            label: "Episode summary",
            hint: "Big ideas only",
            prompt:
              "Summarize the episode for someone who wants the important ideas without watching the full recording. Prioritize major arguments, stories, insights, and conclusions.",
          },
          {
            id: "highlights",
            label: "Best highlights",
            hint: "Memorable moments",
            prompt:
              "Extract the best highlights from this episode: strongest insights, stories, and memorable moments, with timestamps.",
          },
          {
            id: "takeaways",
            label: "Key takeaways",
            hint: "What to remember",
            prompt:
              "List the key takeaways a listener should remember from this episode. Keep them clear, specific, and grounded in what was actually said.",
          },
          {
            id: "opinions",
            label: "Find strong opinions",
            hint: "Arguments & takes",
            prompt:
              "Find the strongest opinions and arguments in this episode. Include speaker, timestamp, and a short context line for each.",
          },
          {
            id: "emotional",
            label: "Find emotional moments",
            hint: "Surprise & energy",
            prompt:
              "Find emotional, surprising, or high-energy moments in this episode. Include timestamps and explain why each moment stands out.",
          },
          {
            id: "weak",
            label: "Find weak/slow sections",
            hint: "Edit candidates",
            prompt:
              "Find weak, slow, or repetitive sections that an editor might tighten. Include timestamps and a short reason for each.",
          },
        ],
      },
    ],
  },
];

export function getAnalysisModeOption(mode: AnalysisMode): AnalysisModeOption {
  return ANALYSIS_MODES.find((item) => item.id === mode) ?? ANALYSIS_MODES[0];
}

export function modeHasPromptActions(mode: AnalysisModeOption): boolean {
  return mode.promptGroups.some((group) => group.actions.length > 0);
}
