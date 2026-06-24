import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pagination from "./Pagination";

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(<Pagination page={1} pageCount={1} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a numbered button for every page when there are few pages", () => {
    render(<Pagination page={1} pageCount={3} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 3" })).toBeInTheDocument();
  });

  it("marks the current page with aria-current", () => {
    render(<Pagination page={2} pageCount={3} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Page 1" })).not.toHaveAttribute("aria-current");
  });

  it("collapses the middle with an ellipsis when there are many pages", () => {
    render(<Pagination page={6} pageCount={12} onChange={() => {}} />);
    // first, last, and a window around the current page are shown
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 12" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 6" })).toBeInTheDocument();
    // a far page is hidden behind the ellipsis
    expect(screen.queryByRole("button", { name: "Page 3" })).toBeNull();
    expect(screen.getAllByText("…").length).toBeGreaterThan(0);
  });

  it("disables prev on the first page and next on the last", () => {
    const { rerender } = render(<Pagination page={1} pageCount={5} onChange={() => {}} />);
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
    expect(screen.getByLabelText("Next page")).not.toBeDisabled();
    rerender(<Pagination page={5} pageCount={5} onChange={() => {}} />);
    expect(screen.getByLabelText("Next page")).toBeDisabled();
  });

  it("calls onChange with the clicked page number", async () => {
    const onChange = vi.fn();
    render(<Pagination page={1} pageCount={3} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("does not call onChange when clicking the current page", async () => {
    const onChange = vi.fn();
    render(<Pagination page={2} pageCount={3} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
