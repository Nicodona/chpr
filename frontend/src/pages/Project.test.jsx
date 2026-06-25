import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Mock the API so the component goes through the real null -> loaded transition
// that previously crashed with React error #310 (hooks after an early return).
vi.mock("../api", () => ({
  fetchProject: vi.fn(() =>
    Promise.resolve({ slug: "breathe", name: "BREATHE", description: "TB project", status: "active" })
  ),
  fetchResources: vi.fn(() =>
    Promise.resolve([
      { id: 1, name: "Algo A", type_key: "alg", project_name: "BREATHE", languages: [] },
      { id: 2, name: "Video B", type_key: "vid", project_name: "BREATHE", languages: [] },
    ])
  ),
}));

import Project from "./Project";

function renderAt(path = "/projects/breathe") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects/:slug" element={<Project />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Project page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders without a hooks error once the project loads (regression: #310)", async () => {
    renderAt();
    // Heading appears only after the async project load resolves — i.e. the
    // component rendered past the early returns without crashing.
    await waitFor(() => expect(screen.getByRole("heading", { name: "BREATHE" })).toBeInTheDocument());
  });

  it("shows type filters derived from the loaded resources", async () => {
    renderAt();
    await screen.findByRole("heading", { name: "BREATHE" });
    // alg + vid present -> Algorithms + Videos filters; empty pool types absent.
    expect(screen.getByRole("button", { name: "Algorithms" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Videos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Posters" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Expert Pool" })).toBeNull();
  });
});
