"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData, type BoardData } from "@/lib/kanban";

const AUTH_KEY = "pm-authenticated";
const DEMO_USERNAME = "user";
const DEMO_PASSWORD = "password";

export default function Home() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isBoardLoading, setIsBoardLoading] = useState(false);
  const [boardSyncError, setBoardSyncError] = useState("");
  const [isBoardReady, setIsBoardReady] = useState(false);
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
      <KanbanBoard board={board} onBoardChange={setBoard} />
    </>
  );
}
