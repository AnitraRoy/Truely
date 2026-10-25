/**
 * Development-only sample sessions for the three report boards, so their
 * layout can be reviewed before any real session exists. Fictional, flagged
 * `sample: true`, labeled on screen, and only reachable in dev builds
 * (CLAUDE.md §5). Never shown as a real person's results.
 */
import type { ConversationKind, ConversationSession, TranscriptSegment } from "@/types";

const s = (m: number, sec = 0) => (m * 60 + sec) * 1000;
const seg = (id: string, start: number, end: number, role: TranscriptSegment["role"], text: string): TranscriptSegment => ({
  id,
  startMs: start,
  endMs: end,
  role,
  text,
  speaker: role === "you" ? "You" : role === "coach" ? "Coach" : role === "interviewer" ? "Interviewer" : undefined,
});
const START = Date.UTC(2026, 9, 23, 17, 42);

const interview: ConversationSession = {
  id: "sample",
  kind: "interview",
  sample: true,
  title: "Behavioral interview",
  startedAt: START,
  endedAt: START + s(9, 10),
  goals: ["Answer with structure", "Use one concrete example"],
  context: { Role: "Product design internship", Difficulty: "Realistic" },
  transcript: [
    seg("i1", s(0, 4), s(0, 14), "interviewer", "Thanks for joining. Tell me about a time you faced a difficult problem on a project."),
    seg("y1", s(0, 18), s(1, 40), "you", "So there was this project last spring, a scheduling tool, and the team had a lot of different opinions, and we'd been going back and forth for a while about what to build first."),
    seg("i2", s(1, 44), s(1, 52), "interviewer", "What made it difficult, specifically?"),
    seg("y2", s(1, 56), s(3, 14), "you", "The main challenge was deciding which problem to solve first. I broke the requests into three groups and picked the one that blocked the most people."),
    seg("i3", s(3, 18), s(3, 26), "interviewer", "How did you check that was the right call?"),
    seg("y3", s(3, 30), s(5, 2), "you", "I ran one small experiment: a paper prototype with five users. That gave us enough evidence to commit, and the team agreed quickly after that."),
    seg("i4", s(5, 6), s(5, 14), "interviewer", "How did you bring the rest of the team along?"),
    seg("y4", s(5, 18), s(7, 40), "you", "I shared the results in our weekly meeting, showed the clips, and asked what would change their mind. Nobody had a stronger option."),
    seg("i5", s(7, 44), s(7, 58), "interviewer", "Thanks, that's the end of our interview."),
  ],
  feedback: [],
  report: {
    summary: "Your answers became more direct as the interview went on: by the second question you named the challenge first, then explained how you handled it.",
    strengths: ["Named the main challenge in one sentence", "Used a specific experiment as evidence", "Closed answers with an outcome"],
    improvements: ["The first answer opened with background before the problem", "Say how many people were blocked, if you know it"],
    nextSteps: ["Open with the problem in one sentence", "Follow with what you did, then the result"],
    moments: [
      { segmentId: "y1", label: "Long setup", note: "The problem itself came after several clauses of background." },
      { segmentId: "y2", label: "Clear structure", note: "You stated the challenge first, then the action you took." },
      { segmentId: "y3", label: "Concrete example", note: "The paper prototype with five users made the decision easy to follow." },
    ],
  },
};

const voice: ConversationSession = {
  id: "sample",
  kind: "voice",
  sample: true,
  title: "Voice practice",
  startedAt: START - s(60 * 24),
  endedAt: START - s(60 * 24) + s(6, 12),
  goals: ["Lead with the main point", "Shorter setup"],
  context: { Prompt: "Explain a project update to someone outside your team." },
  transcript: [
    seg("c1", s(0, 2), s(0, 8), "coach", "Let's make your point clearer. Explain the update the way you normally would."),
    seg("v1", s(0, 32), s(1, 10), "you", "I just wanted to give some background first on how the project started and where we were a month ago before getting into what's changed."),
    seg("c2", s(1, 14), s(1, 22), "coach", "You got to the update in the end. Try again, and start with what you need from them."),
    seg("v2", s(1, 28), s(2, 4), "you", "The main thing I want to explain is that we need one more week, because the vendor's data arrived late."),
    seg("c3", s(2, 8), s(2, 16), "coach", "Much more direct. Now add one sentence on what the extra week gets them."),
    seg("v3", s(3, 44), s(4, 20), "you", "We need one more week. With it, the report covers the whole quarter instead of two months."),
  ],
  feedback: [
    { id: "f1", atMs: s(0, 32), segmentId: "v1", category: "clarity", title: "Lead with your conclusion", explanation: "The request came after the project history.", suggestion: "The main thing I need from you is…" },
    { id: "f2", atMs: s(1, 28), segmentId: "v2", category: "structure", title: "Add the benefit", explanation: "The reason is clear; the payoff of the extra week isn't yet." },
  ],
  report: {
    summary: "You moved from background-first to request-first: the third answer opened with the ask and gave one reason and one benefit.",
    strengths: ["Opened with the request by the second try", "Kept the reason to one sentence"],
    improvements: ["The first answer spent its opening on history"],
    nextSteps: ["Lead with your request", "Use one sentence of context", "Pause before the example"],
    moments: [
      { segmentId: "v1", label: "Before", note: "The opening sentence was about how the project started." },
      { segmentId: "v3", label: "Revision", note: "The request came first, followed by a single concrete benefit." },
    ],
  },
};

const live: ConversationSession = {
  id: "sample",
  kind: "live",
  sample: true,
  title: "Project team check-in",
  startedAt: START - s(60 * 72),
  endedAt: START - s(60 * 72) + s(14, 30),
  goals: ["Lead with the main point"],
  transcript: [
    seg("l1", s(1, 10), s(1, 19), undefined, "We need to decide what to ship this week, the full redesign or the smaller fix."),
    seg("l2", s(1, 20), s(1, 29), undefined, "I think we have two options, and both have trade-offs. The redesign touches every screen, which means more testing."),
    seg("l3", s(1, 30), s(1, 39), undefined, "The smaller fix is safer, but it doesn't solve the navigation problem people keep reporting."),
    seg("l4", s(5, 0), s(5, 9), undefined, "What would you recommend?"),
    seg("l5", s(5, 10), s(5, 19), undefined, "I'd start with the smaller change this week and plan the redesign for next sprint."),
    seg("l6", s(9, 40), s(9, 49), undefined, "Does everyone agree with that plan, or is there something I'm missing?"),
  ],
  feedback: [
    { id: "lf1", atMs: s(1, 30), segmentId: "l3", category: "clarity", title: "Give your recommendation first", explanation: "You laid out both options; the choice hadn't been stated yet." },
  ],
  report: {
    summary: "You explained the trade-off clearly, and your recommendation was easiest to act on once you stated it directly.",
    strengths: ["Named the trade-off between the two options", "Checked whether the team agreed"],
    improvements: ["The recommendation came after both options were explained"],
    nextSteps: ["State the choice first", "Give one reason", "Then ask for concerns"],
    moments: [
      { segmentId: "l2", label: "Trade-off named", note: "You set out what each option would cost before choosing." },
      { segmentId: "l5", label: "Clear recommendation", note: "One sentence with the choice and the timing." },
      { segmentId: "l6", label: "Checked agreement", note: "You invited objections instead of assuming consensus." },
    ],
  },
};

export const SAMPLE_SESSIONS: Record<ConversationKind, ConversationSession> = { interview, voice, live };

export const SAMPLE_REPORT_LINKS = [
  { label: "mock interview", href: "/report/interview/sample" },
  { label: "voice coaching", href: "/report/voice/sample" },
  { label: "live coaching", href: "/report/live/sample" },
];
