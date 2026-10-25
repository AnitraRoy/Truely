/**
 * Development-only scripted turns, so the running practice screens can be
 * designed and reviewed without provider keys. Every line is labelled
 * "sample" on screen and these never run in production builds (CLAUDE.md §5:
 * mock data is clearly labelled in development).
 */
import type { ParsedSuggestion } from "@/lib/conversation";

export const DEV_COACH_TURNS: { reply: string; suggestions: ParsedSuggestion[] }[] = [
  { reply: "Let's make your point clearer. Go ahead and explain it the way you normally would.", suggestions: [] },
  {
    reply: "You got to the decision in the end. Try it once more, and start with the decision you need.",
    suggestions: [
      { category: "clarity", title: "Lead with your conclusion", explanation: "The ask came after three sentences of background.", suggestion: "The main thing I need from you is…" },
      { category: "conciseness", title: "Trim the setup", explanation: "The project history isn't needed for this decision." },
    ],
  },
  {
    reply: "That opening was much more direct. Now add one concrete example.",
    suggestions: [{ category: "structure", title: "Use one example", explanation: "A specific case would make the trade-off easier to picture." }],
  },
];

export const DEV_INTERVIEW_TURNS = [
  "Thanks for joining. To start, tell me about a time you worked through an ambiguous problem.",
  "What was the first thing you did to make it less ambiguous?",
  "How did you know your approach was working?",
  "Thanks, that's the end of our interview. Nice talking with you.",
];
