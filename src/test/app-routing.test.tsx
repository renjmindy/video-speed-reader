import { QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import App from "@/App";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App queryClient={new QueryClient()} />
    </MemoryRouter>,
  );
}

describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    renderAt("/");
    expect(screen.queryByText("Page not found")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Video Speed Reader" })).toBeInTheDocument();
  });

  it.each([
    ["/signin", "Sign in / 登入"],
    ["/signup", "Create account / 註冊"],
  ])("renders %s", (path, heading) => {
    renderAt(path);
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("falls back to not found for unknown routes", () => {
    renderAt("/nope");
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
});
