"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData, type BoardData } from "@/lib/kanban";

const AUTH_KEY = "pm-authenticated";
const DEMO_USERNAME = "user";
const DEMO_PASSWORD = "password";

type ChatRole = "user" | "assistant";
type ChatMessage = {
  role: ChatRole;
  content: string;
};

export default function Home() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isBoardLoading, setIsBoardLoading] = useState(false);
  const [boardSyncError, setBoardSyncError] = useState("");
  const [isBoardReady, setIsBoardReady] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const skipNextSave = useRef(false);

  useEffect(() => {
    setIsAuthed(window.localStorage.getItem(AUTH_KEY) === "true");
  }, []);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
      window.localStorage.setItem(AUTH_KEY, "true");
      setIsAuthed(true);
      setError("");
      return;
    }
    setError("Invalid credentials. Use user / password.");
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_KEY);
    setIsAuthed(false);
    setUsername("");
    setPassword("");
    setError("");
    setBoardSyncError("");
    setIsBoardReady(false);
    setChatInput("");
    setChatHistory([]);
    setAiError("");
    setIsAiLoading(false);
  };

  useEffect(() => {
    if (!isAuthed) {
      return;
    }
    let cancelled = false;
    const loadBoard = async () => {
      setIsBoardLoading(true);
      setBoardSyncError("");
      setIsBoardReady(false);
      try {
        const response = await fetch(`/api/board?username=${DEMO_USERNAME}`);
        if (!response.ok) {
          throw new Error(`Failed to load board: ${response.status}`);
        }
        const data = (await response.json()) as { board?: BoardData };
        if (!data.board || !Array.isArray(data.board.columns) || !data.board.cards) {
          throw new Error("Received invalid board payload.");
        }
        if (!cancelled) {
          skipNextSave.current = true;
          setBoard(data.board);
          setIsBoardReady(true);
        }
      } catch {
        if (!cancelled) {
          setBoardSyncError("Unable to load board from backend.");
          setIsBoardReady(true);
        }
      } finally {
        if (!cancelled) {
          setIsBoardLoading(false);
        }
      }
    };
    void loadBoard();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed || !isBoardReady || isBoardLoading) {
      return;
    }
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const persistBoard = async () => {
      try {
        const response = await fetch("/api/board", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: DEMO_USERNAME, board }),
        });
        if (!response.ok) {
          throw new Error(`Failed to save board: ${response.status}`);
        }
        setBoardSyncError("");
      } catch {
        setBoardSyncError("Unable to save board to backend.");
      }
    };
    void persistBoard();
  }, [board, isAuthed, isBoardReady, isBoardLoading]);

  const handleSendChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || isAiLoading) {
      return;
    }
    const nextHistory: ChatMessage[] = [...chatHistory, { role: "user", content: message }];
    setChatInput("");
    setChatHistory(nextHistory);
    setAiError("");
    setIsAiLoading(true);

    try {
      const response = await fetch("/api/ai/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: DEMO_USERNAME,
          message,
          history: nextHistory,
        }),
      });
      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        const detail =
          errorPayload && typeof errorPayload.detail === "string"
            ? errorPayload.detail
            : `Request failed with status ${response.status}.`;
        throw new Error(detail);
      }
      const data = (await response.json()) as {
        assistantMessage?: string;
        board?: BoardData;
      };
      if (
        !data.board ||
        !Array.isArray(data.board.columns) ||
        !data.board.cards ||
        typeof data.assistantMessage !== "string"
      ) {
        throw new Error("Invalid AI response payload.");
      }
      skipNextSave.current = true;
      setBoard(data.board);
      setChatHistory((prev) => [...prev, { role: "assistant", content: data.assistantMessage! }]);
    } catch (error) {
      const detail =
        error instanceof Error && error.message
          ? error.message
          : "Unable to process AI request.";
      setAiError(detail);
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!isAuthed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <section className="w-full rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
            PM MVP
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            Sign in
          </h1>
          <p className="mt-3 text-sm text-[var(--gray-text)]">
            Use the demo credentials to access your board.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
                Username
              </span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                autoComplete="username"
                aria-label="Username"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                autoComplete="current-password"
                aria-label="Password"
              />
            </label>
            {error ? (
              <p className="text-sm font-medium text-[var(--secondary-purple)]">{error}</p>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-xl bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white"
            >
              Sign in
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <>
      {isBoardLoading ? (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] shadow-[var(--shadow)]">
          Loading board...
        </div>
      ) : null}
      {boardSyncError ? (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-[var(--accent-yellow)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--navy-dark)] shadow-[var(--shadow)]">
          {boardSyncError}
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleLogout}
        className="fixed right-6 top-6 z-50 rounded-full border border-[var(--stroke)] bg-white/95 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--navy-dark)] shadow-[var(--shadow)] backdrop-blur"
      >
        Log out
      </button>
      <div className="grid grid-cols-1 gap-6 px-6 pb-12 pt-20 xl:grid-cols-[minmax(0,1fr)_400px]">
        <KanbanBoard board={board} onBoardChange={setBoard} />
        <aside
          className="h-fit rounded-3xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)] xl:sticky xl:top-20"
          aria-label="AI sidebar"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
            AI Assistant
          </p>
          <h2 className="mt-2 font-display text-[1.9rem] font-semibold leading-tight text-[var(--navy-dark)]">
            Board Chat
          </h2>
          <p className="mt-2 text-base leading-6 text-[var(--gray-text)]">
            Ask AI to create, edit, or move cards.
          </p>

          <div
            className="mt-5 max-h-[480px] space-y-3 overflow-y-auto rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-4"
            data-testid="chat-history"
          >
            {chatHistory.length === 0 ? (
              <p className="text-base text-[var(--gray-text)]">No messages yet.</p>
            ) : (
              chatHistory.map((entry, index) => (
                <div
                  key={`${entry.role}-${index}`}
                  className={`rounded-xl px-4 py-3 text-[15px] leading-6 ${
                    entry.role === "user"
                      ? "bg-[var(--primary-blue)] text-white"
                      : "bg-white text-[var(--navy-dark)]"
                  }`}
                >
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-80">
                    {entry.role}
                  </p>
                  <p>{entry.content}</p>
                </div>
              ))
            )}
          </div>

          <form className="mt-5 space-y-3" onSubmit={handleSendChat}>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
                Message
              </span>
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                aria-label="Chat message"
                rows={4}
                placeholder="Move card-1 to Done"
                className="w-full resize-y rounded-xl border border-[var(--stroke)] px-4 py-3 text-base leading-6 text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              />
            </label>
            {aiError ? (
              <p className="rounded-xl border border-[var(--secondary-purple)]/25 bg-[var(--secondary-purple)]/8 px-3 py-2 text-sm font-medium text-[var(--secondary-purple)]">
                {aiError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isAiLoading}
              className="w-full rounded-xl bg-[var(--secondary-purple)] px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAiLoading ? "Sending..." : "Send"}
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
