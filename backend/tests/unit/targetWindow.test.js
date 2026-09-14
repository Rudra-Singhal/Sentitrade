const { windowedText, splitSentences } = require("../../src/pipeline/targetWindow");

describe("targetWindow.splitSentences", () => {
  it("splits on sentence-ending punctuation followed by a capital/digit", () => {
    expect(splitSentences("NVDA soars on demand. INTC stumbles again.")).toEqual([
      "NVDA soars on demand.",
      "INTC stumbles again."
    ]);
  });

  it("treats a single clause without sentence punctuation as one sentence", () => {
    // Documented limitation: this is a real boundary, not a bug.
    expect(splitSentences("NVDA soars as INTC stumbles")).toEqual(["NVDA soars as INTC stumbles"]);
  });

  it("handles empty input", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences(undefined)).toEqual([]);
  });
});

describe("targetWindow.windowedText", () => {
  const twoSentence =
    "NVDA soars on strong AI demand. Meanwhile INTC stumbles after another delayed node.";

  it("the roadmap case: opposite-toned sentences narrow to different text per target", () => {
    const forNvda = windowedText(twoSentence, "NVDA", 2);
    const forIntc = windowedText(twoSentence, "INTC", 2);

    expect(forNvda).toContain("NVDA soars");
    expect(forNvda).not.toContain("INTC stumbles");
    expect(forIntc).toContain("INTC stumbles");
    expect(forIntc).not.toContain("NVDA soars");
    expect(forNvda).not.toBe(forIntc);
  });

  it("is a no-op when the document only resolves to one asset", () => {
    // The overwhelming majority of real documents: single-asset, unaffected.
    expect(windowedText(twoSentence, "NVDA", 1)).toBe(twoSentence);
    expect(windowedText(twoSentence, "NVDA", 0)).toBe(twoSentence);
  });

  it("is a no-op with no target or an unresolvable symbol", () => {
    expect(windowedText(twoSentence, undefined, 2)).toBe(twoSentence);
    expect(windowedText(twoSentence, "NOTAREALTICKER", 2)).toBe(twoSentence);
  });

  it("falls back to the full text when the target isn't textually found", () => {
    // entities said 2, but the target's own aliases don't appear verbatim —
    // don't guess which sentence it might mean.
    const text =
      "Markets rallied broadly today on strong jobs data. Traders stayed cautious into the close.";
    expect(windowedText(text, "NVDA", 2)).toBe(text);
  });

  it("falls back to the full text when there is only one sentence to narrow within", () => {
    expect(windowedText("NVDA soars as INTC stumbles", "NVDA", 2)).toBe(
      "NVDA soars as INTC stumbles"
    );
  });

  it("keeps every sentence that mentions the target when it appears more than once", () => {
    const text = "NVDA rallied at the open. Volume was thin. NVDA gave back gains by the close.";
    const windowed = windowedText(text, "NVDA", 2);
    expect(windowed).toContain("rallied at the open");
    expect(windowed).toContain("gave back gains");
    expect(windowed).not.toContain("Volume was thin");
  });
});
