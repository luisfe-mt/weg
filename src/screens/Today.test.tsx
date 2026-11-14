import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getInstalledAt } from "@/lib/db";
import { Today } from "./Today";

vi.mock("@/lib/db", () => ({ getInstalledAt: vi.fn() }));

describe("Today", () => {
  beforeEach(() => {
    vi.mocked(getInstalledAt).mockReset();
  });

  it("shows a disabled Start button until a session can be planned", async () => {
    vi.mocked(getInstalledAt).mockResolvedValue("2026-11-14 10:00:00");
    render(<Today />);
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(await screen.findByText("Local database ready.")).toBeInTheDocument();
  });

  it("reports a database failure instead of hiding it", async () => {
    vi.mocked(getInstalledAt).mockRejectedValue(new Error("disk full"));
    render(<Today />);
    expect(await screen.findByText(/Local database failed: Error: disk full/)).toBeInTheDocument();
  });
});
