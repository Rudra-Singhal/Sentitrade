import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DataSourceBadge from "./DataSourceBadge.jsx";

describe("DataSourceBadge", () => {
  it("renders nothing without a source", () => {
    const { container } = render(<DataSourceBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the label and a relative age", () => {
    render(<DataSourceBadge source="simulated" asOf={new Date().toISOString()} />);
    expect(screen.getByText(/simulated/i)).toBeInTheDocument();
    expect(screen.getByText(/just now/i)).toBeInTheDocument();
  });

  it("shows an unavailable badge without an age", () => {
    render(<DataSourceBadge source="unavailable" />);
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });
});
