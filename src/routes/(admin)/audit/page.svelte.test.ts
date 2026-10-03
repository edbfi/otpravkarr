import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "$lib/db/types";
import AuditPage from "./+page.svelte";

const mocks = vi.hoisted(() => ({
  goto: vi.fn(async () => undefined),
}));

vi.mock("$app/navigation", () => ({
  goto: mocks.goto,
}));

vi.mock("$app/state", () => ({
  page: {
    url: new URL("http://localhost/audit"),
  },
}));

const entryWithDetail: AuditEntry = {
  id: 1,
  timestamp: "2025-01-01T10:00:00Z",
  actor: "admin",
  action: "admin.login",
  detail: JSON.stringify({ scope: "settings", changed: true }),
  ip_address: "127.0.0.1",
};

const defaultData = {
  entries: [entryWithDetail],
  total: 1,
  filters: {
    action: null,
    actor: null,
    after: null,
    before: null,
    page: 1,
    limit: 25,
  },
  totalPages: 1,
  auditActions: ["admin.login"],
};

describe("admin audit page", () => {
  beforeEach(() => {
    mocks.goto.mockClear();
  });

  it("renders a 24px detail expand control and expands formatted JSON", async () => {
    render(AuditPage, { props: { data: defaultData } });

    const expandButton = screen.getByRole("button", {
      name: /Expand detail for admin\.login/,
    });
    expect(expandButton.classList.contains("size-6")).toBe(true);

    await fireEvent.click(expandButton);

    expect(screen.getByText(/"scope": "settings"/)).toBeTruthy();
    expect(expandButton.getAttribute("aria-expanded")).toBe("true");
  });

  describe("navigation (M4(b): Kit 3 has no keep-focus-but-reset-scroll mode)", () => {
    const pagedData = { ...defaultData, total: 75, filters: { ...defaultData.filters, page: 2 } };
    let scrollTo: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      scrollTo = vi.fn();
      vi.stubGlobal("scrollTo", scrollTo);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it.each([
      ["Next", "3"],
      ["Previous", "1"],
    ])("%s keeps focus, replaces history and scrolls to the top", async (name, target) => {
      render(AuditPage, { props: { data: { ...pagedData, totalPages: 3 } } });

      await fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));

      expect(mocks.goto).toHaveBeenCalledOnce();
      const [url, options] = mocks.goto.mock.calls[0] as unknown as [string, unknown];
      expect(new URL(url).searchParams.get("page")).toBe(target);
      expect(options).toEqual({ replace: true, reset: false });
      await vi.waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0 }));
    });

    it("keeps the scroll position when a filter changes", async () => {
      vi.useFakeTimers();
      render(AuditPage, { props: { data: { ...pagedData, totalPages: 3 } } });

      await fireEvent.input(screen.getByLabelText("Filter by actor or user"), {
        target: { value: "admin" },
      });
      await vi.advanceTimersByTimeAsync(300);

      expect(mocks.goto).toHaveBeenCalledOnce();
      const [url, options] = mocks.goto.mock.calls[0] as unknown as [string, unknown];
      expect(new URL(url).searchParams.get("actor")).toBe("admin");
      expect(new URL(url).searchParams.has("page")).toBe(false);
      expect(options).toEqual({ replace: true, reset: false });
      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});
