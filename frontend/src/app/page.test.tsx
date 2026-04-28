import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { initialData, type BoardData } from "@/lib/kanban";

const makeResponse = (body: unknown, ok = true) =>
  new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null =
    null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  start = vi.fn();
  stop = vi.fn(() => {
    this.onend?.();
  });

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }

  emitTranscript(transcript: string) {
    this.onresult?.({
      resultIndex: 0,
      results: [{ 0: { transcript }, length: 1, isFinal: true }],
    });
  }
}

describe("Home auth gate", () => {
  let boardStore: BoardData;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    MockSpeechRecognition.instances = [];
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
        const message = payload.message.toLowerCase();
        if (message.includes("move card-1")) {
          nextBoard.columns[0].cardIds = nextBoard.columns[0].cardIds.filter((id) => id !== "card-1");
          nextBoard.columns[4].cardIds = [...nextBoard.columns[4].cardIds, "card-1"];
        }
        if (message.includes("rename")) {
          nextBoard.columns[0].title = "AI Renamed";
        }
        if (message.includes("create")) {
          nextBoard.cards["card-voice"] = {
            id: "card-voice",
            title: "Voice card",
            details: "Created from voice command.",
          };
          nextBoard.columns[0].cardIds = [...nextBoard.columns[0].cardIds, "card-voice"];
        }
        if (message.includes("edit card-2")) {
          nextBoard.cards["card-2"] = {
            ...nextBoard.cards["card-2"],
            title: "Signals Updated",
            details: "Updated via voice",
          };
        }
        if (message.includes("delete card-3")) {
          delete nextBoard.cards["card-3"];
          nextBoard.columns = nextBoard.columns.map((column) => ({
            ...column,
            cardIds: column.cardIds.filter((id) => id !== "card-3"),
          }));
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
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
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

  it("shows unsupported message when speech API is unavailable", async () => {
    vi.stubGlobal("SpeechRecognition", undefined);
    render(<Home />);
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Voice input not supported on this browser.")).toBeInTheDocument();
  });

  it("transitions listening state and clears transcript", async () => {
    render(<Home />);
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    const sidebar = await screen.findByRole("complementary", { name: /ai sidebar/i });
    const startButton = within(sidebar).getByRole("button", { name: /start listening/i });
    await userEvent.click(startButton);
    expect(within(sidebar).getByText("Listening...")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Chat message"), "voice transcript");
    await userEvent.click(within(sidebar).getByRole("button", { name: /clear/i }));
    expect(screen.getByLabelText("Chat message")).toHaveValue("");
  });

  it("routes voice transcript through AI endpoint and applies move + rename updates", async () => {
    render(<Home />);
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    const sidebar = await screen.findByRole("complementary", { name: /ai sidebar/i });
    await userEvent.click(within(sidebar).getByRole("button", { name: /start listening/i }));
    const recognition = MockSpeechRecognition.instances.at(-1);
    expect(recognition).toBeDefined();
    await act(async () => {
      recognition?.emitTranscript("Move card-1 to done and rename backlog");
    });

    await userEvent.click(within(sidebar).getByRole("button", { name: /^send$/i }));
    expect(await screen.findByDisplayValue("AI Renamed")).toBeInTheDocument();
    expect(await screen.findByTestId("column-col-done")).toHaveTextContent("Align roadmap themes");
  });

  it("applies create edit and delete operations from one voice transcript", async () => {
    render(<Home />);
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    const sidebar = await screen.findByRole("complementary", { name: /ai sidebar/i });
    await userEvent.click(within(sidebar).getByRole("button", { name: /start listening/i }));
    const recognition = MockSpeechRecognition.instances.at(-1);
    await act(async () => {
      recognition?.emitTranscript("Create card edit card-2 and delete card-3");
    });

    await userEvent.click(within(sidebar).getByRole("button", { name: /^send$/i }));
    expect(await screen.findByText("Voice card")).toBeInTheDocument();
    expect(await screen.findByText("Signals Updated")).toBeInTheDocument();
    expect(screen.queryByText("Prototype analytics view")).not.toBeInTheDocument();
  });
});
