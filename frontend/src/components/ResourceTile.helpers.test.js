import { describe, it, expect } from "vitest";
import { primaryUrl, isPdf, LANG_SHORT } from "./ResourceTile";

describe("primaryUrl", () => {
  it("prefers the English language file", () => {
    const r = {
      languages: [
        { language: "fr", url: "/media/fr.mp4" },
        { language: "en", url: "/media/en.mp4" },
        { language: "pcm", url: "/media/pcm.mp4" },
      ],
    };
    expect(primaryUrl(r)).toBe("/media/en.mp4");
  });

  it("falls back to the first language when there is no English", () => {
    const r = {
      languages: [
        { language: "fr", url: "/media/fr.mp4" },
        { language: "ful", url: "/media/ful.mp4" },
      ],
    };
    expect(primaryUrl(r)).toBe("/media/fr.mp4");
  });

  it("falls back to the legacy file_url when there are no language files", () => {
    expect(primaryUrl({ languages: [], file_url: "/media/legacy.pdf" })).toBe("/media/legacy.pdf");
    expect(primaryUrl({ file_url: "/media/legacy.pdf" })).toBe("/media/legacy.pdf");
  });

  it("returns null when nothing is available", () => {
    expect(primaryUrl({})).toBeNull();
    expect(primaryUrl({ languages: [] })).toBeNull();
  });
});

describe("isPdf", () => {
  it("detects pdf urls regardless of case or querystring", () => {
    expect(isPdf("/media/a.pdf")).toBe(true);
    expect(isPdf("/media/A.PDF")).toBe(true);
    expect(isPdf("/media/a.pdf?v=2")).toBe(true);
  });
  it("returns false for non-pdf or empty", () => {
    expect(isPdf("/media/a.mp4")).toBe(false);
    expect(isPdf("")).toBe(false);
    expect(isPdf(null)).toBe(false);
  });
});

describe("LANG_SHORT labels", () => {
  it("maps the four supported languages to display labels", () => {
    expect(LANG_SHORT).toMatchObject({ en: "EN", fr: "FR", pcm: "Pidgin", ful: "Fulfulde" });
  });
});
