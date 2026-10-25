import { describe, expect, it } from "vitest";
import { findFillers, quickCues, wordsPerMinute } from "../quickCues";
import type { TranscriptSegment } from "@/types";

const seg = (text: string, ms: number): TranscriptSegment => ({ id: "s", startMs: 0, endMs: ms, text, role: "you", speaker: "You" });
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const titles = (s: TranscriptSegment) => quickCues(s).map((c) => c.title);

describe("quickCues", () => {
  it("says nothing about a clear, well-paced answer", () => {
    expect(titles(seg("I cut our release time from two days to four hours by automating the tests.", 6000))).toEqual([]);
  });

  it("cues 'Slow down' above the pace limit, but not for answers too short to judge", () => {
    expect(wordsPerMinute(seg(words(60), 15000))).toBe(240);
    expect(titles(seg(words(60), 15000))).toContain("Slow down");
    expect(wordsPerMinute(seg(words(20), 3000))).toBeNull();
    expect(titles(seg(words(20), 3000))).not.toContain("Slow down");
  });

  it("cues 'Cut filler words' and names the fillers it heard", () => {
    const text = "Um, so basically the project was, like, about onboarding, and uh I mean it went well overall I think";
    expect(findFillers(text)).toEqual(["um", "basically", "like", "uh", "i mean"]);
    const cue = quickCues(seg(text, 10000)).find((c) => c.title === "Cut filler words");
    expect(cue?.explanation).toMatch(/5 fillers, like "um" and "basically"/);
  });

  it("doesn't count 'like' used as a verb", () => {
    expect(findFillers("I like building tools people like to use")).toEqual([]);
  });

  it("cues 'Wrap it up' for long answers", () => {
    expect(titles(seg(words(200), 90000))).toContain("Wrap it up");
  });
});
