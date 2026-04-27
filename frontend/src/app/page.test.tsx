import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { initialData, type BoardData } from "@/lib/kanban";

const makeResponse = (body: unknown, ok = true) =>
  new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });

describe("Home auth gate", () => {
  let boardStore: BoardData;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    boardStore = structuredClone(initialData);
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.includes("/api/board") && method === "GET") {
        return makeResponse({ username: "user", board: boardStore });
      }
      if (url.includes("/api/board") && method === "PUT") {
        const payload = JSON.parse(String(init?.body)) as {
          username: string;
          board: BoardData;
        };
        boardStore = payload.board;
        return makeResponse({ ok: true });
      }
      if (url.includes("/api/ai/board") && method === "POST") {
        const payload = JSON.parse(String(init?.body)) as {
          message: string;
        };
        const nextBoard = structuredClone(boardStore);
        if (payload.message.toLowerCase().includes("rename")) {
          nextBoard.columns[0].title = "AI Renamed";
        }
        boardStore = nextBoard;
        return makeResponse({
          assistantMessage: "Handled your request.",
          operations: [],
          board: boardStore,
        });
      }
      return makeResponse({ status: "ok" });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("shows login form when unauthenticated", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();
  });

  it("shows error for invalid credentials", async () => {
    render(<Home />);

    await userEvent.type(screen.getByLabelText("Username"), "wrong");
    await userEvent.type(screen.getByLabelText("Password"), "bad");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      screen.getByText("Invalid credentials. Use user / password.")
    ).toBeInTheDocument();
  });

  it("logs in and logs out with demo credentials", async () => {
    render(<Home />);

    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("button", { name: /log out/i })).toBeInTheDocument();
    expect(await screen.findByText("Kanban Studio")).toBeInTheDocument();
    expect(window.localStorage.getItem("pm-authenticated")).toBe("true");

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));

    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(window.localStorage.getItem("pm-authenticated")).toBeNull();
  });

  it("keeps board state across logout and re-login", async () => {
    render(<Home />);

    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    const firstColumnTitle = (await screen.findAllByLabelText("Column title"))[0];
    await userEvent.clear(firstColumnTitle);
    await userEvent.type(firstColumnTitle, "Saved Column");
    expect(firstColumnTitle).toHaveValue("Saved Column");

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect((await screen.findAllByLabelText("Column title"))[0]).toHaveValue("Saved Column");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("renders AI sidebar after login and sends chat", async () => {
    render(<Home />);

    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("complementary", { name: /ai sidebar/i })).toBeInTheDocument();
    expect(screen.getByText("No messages yet.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Chat message"), "please rename column");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    const chatHistory = screen.getByTestId("chat-history");
    expect(await within(chatHistory).findByText("please rename column")).toBeInTheDocument();
    expect(await within(chatHistory).findByText("Handled your request.")).toBeInTheDocument();
    expect((await screen.findAllByLabelText("Column title"))[0]).toHaveValue("AI Renamed");
  });

  it("shows chat error when AI request fails", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.includes("/api/board") && method === "GET") {
        return makeResponse({ username: "user", board: boardStore });
      }
      if (url.includes("/api/ai/board") && method === "POST") {
        return makeResponse({ detail: "Model response was not valid JSON." }, false);
      }
      if (url.includes("/api/board") && method === "PUT") {
        return makeResponse({ ok: true });
      }
      return makeResponse({ status: "ok" });
    });

    render(<Home />);
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await userEvent.type(screen.getByLabelText("Chat message"), "do anything");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText("Model response was not valid JSON.")).toBeInTheDocument();
  });
});
