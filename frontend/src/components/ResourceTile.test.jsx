import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ResourceTile from "./ResourceTile";

function renderTile(resource) {
  return render(
    <MemoryRouter>
      <ResourceTile resource={resource} />
    </MemoryRouter>
  );
}

const base = {
  id: 1,
  name: "Lung Flute Introductory Video",
  type_key: "vid",
  type_label: "Video",
  project_name: "BREATHE",
};

describe("ResourceTile", () => {
  it("renders the resource title", () => {
    renderTile({ ...base, languages: [{ language: "en", url: "/m/en.mp4" }] });
    expect(screen.getByText("Lung Flute Introductory Video")).toBeInTheDocument();
  });

  it("shows a language pill for each language when more than one exists", () => {
    renderTile({
      ...base,
      languages: [
        { language: "en", url: "/m/en.mp4" },
        { language: "fr", url: "/m/fr.mp4" },
        { language: "pcm", url: "/m/pcm.mp4" },
        { language: "ful", url: "/m/ful.mp4" },
      ],
    });
    expect(screen.getByText("EN")).toBeInTheDocument();
    expect(screen.getByText("FR")).toBeInTheDocument();
    expect(screen.getByText("Pidgin")).toBeInTheDocument();
    expect(screen.getByText("Fulfulde")).toBeInTheDocument();
  });

  it("hides language pills when there is only one language", () => {
    renderTile({ ...base, languages: [{ language: "en", url: "/m/en.mp4" }] });
    expect(screen.queryByText("EN")).toBeNull();
  });

  it("links to the resource detail page", () => {
    renderTile({ ...base, languages: [{ language: "en", url: "/m/en.mp4" }] });
    expect(screen.getByRole("link")).toHaveAttribute("href", "/resources/1");
  });
});
