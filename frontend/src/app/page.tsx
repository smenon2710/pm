"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData, type BoardData } from "@/lib/kanban";

const AUTH_KEY = "pm-authenticated";
const DEMO_USERNAME = "user";
const DEMO_PASSWORD = "password";

type BoardInfo = {
  id: number;
  title: string;
  updated_at: string;
};

type ChatRole = "user" | "assistant";
type ChatMessage = {
  role: ChatRole;
  content: string;
};

type SpeechRecognitionError =
  | "aborted"
  | "audio-capture"
  | "network"
  | "not-allowed"
  | "service-not-allowed"
  | "no-speech"
  | "language-not-supported";

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { 0: { transcript: string }; isFinal: boolean; length: number }[];
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const VOICE_ERROR_MESSAGES: Partial<Record<SpeechRecognitionError, string>> = {
  "not-allowed": "Microphone access denied. Allow access and try again.",
  "service-not-allowed": "Microphone access denied. Allow access and try again.",
  "no-speech": "No speech detected. Try again.",
  "audio-capture": "No microphone available.",
};

export default function Home() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isBoardLoading, setIsBoardLoading] = useState(false);
  const [boardSyncError, setBoardSyncError] = useState("");
  const [isBoardReady, setIsBoardReady] = useState(false);
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<number | null>(null);
  const [isBoardsLoading, setIsBoardsLoading] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [showBoardForm, setShowBoardForm] = useState(false);
  const [isRenamingBoard, setIsRenamingBoard] = useState(false);
  const [renameBoardTitle, setRenameBoardTitle] = useState("");
  const [boardActionError, setBoardActionError] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastVoiceCommand, setLastVoiceCommand] = useState("");
  const [voiceStatusMessage, setVoiceStatusMessage] = useState("");
  const [lastAppliedSummary, setLastAppliedSummary] = useState("");
  const skipNextSave = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setIsAuthed(window.localStorage.getItem(AUTH_KEY) === "true");
  }, []);

  const loadBoards = async () => {
    setIsBoardsLoading(true);
    try {
      const response = await fetch(`/api/boards?username=${DEMO_USERNAME}`);
      if (response.ok) {
        const data = (await response.json()) as { boards: BoardInfo[] };
        if (Array.isArray(data.boards)) {
          setBoards(data.boards);
          if (data.boards.length > 0 && !currentBoardId) {
            setCurrentBoardId(data.boards[0].id);
          }
        }
      }
    } catch {
      // non-fatal
    } finally {
      setIsBoardsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthed) {
      void loadBoards();
    }
  }, [isAuthed]);

  useEffect(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setIsVoiceSupported(false);
      return;
    }
    setIsVoiceSupported(true);
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: unknown) => {
      const speechEvent = event as SpeechRecognitionEventLike;
      let transcript = "";
      for (let i = speechEvent.resultIndex; i < speechEvent.results.length; i += 1) {
        transcript += speechEvent.results[i][0].transcript;
      }
      const nextValue = transcript.trim();
      setChatInput(nextValue);
      if (nextValue) {
        setLastTranscript(nextValue);
        setLastVoiceCommand(nextValue);
        setVoiceStatusMessage("Voice transcript captured. You can edit before sending.");
      }
      setVoiceError("");
    };
    recognition.onerror = (event: unknown) => {
      const code = (event as { error: SpeechRecognitionError }).error;
      const message = VOICE_ERROR_MESSAGES[code] ?? "Voice recognition failed. Please try again.";
      setIsListening(false);
      setVoiceError(message);
      setVoiceStatusMessage(message);
    };
    recognition.onend = () => {
      setIsListening(false);
      setVoiceStatusMessage("Stopped listening.");
    };
    recognitionRef.current = recognition;
    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
      window.localStorage.setItem(AUTH_KEY, "true");
      setIsAuthed(true);
      setLoginError("");
      return;
    }
    setLoginError("Invalid credentials. Use user / password.");
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_KEY);
    setIsAuthed(false);
    setUsername("");
    setPassword("");
    setLoginError("");
    setBoardSyncError("");
    setBoardActionError("");
    setIsBoardReady(false);
    setChatInput("");
    setChatHistory([]);
    setAiError("");
    setIsAiLoading(false);
    setIsListening(false);
    setVoiceError("");
    setLastTranscript("");
    setLastVoiceCommand("");
    setVoiceStatusMessage("");
    setLastAppliedSummary("");
    setBoards([]);
    setCurrentBoardId(null);
    setShowBoardForm(false);
    setIsRenamingBoard(false);
    recognitionRef.current?.stop();
  };

  useEffect(() => {
    if (!isAuthed || !currentBoardId) {
      return;
    }
    let cancelled = false;
    const loadBoard = async () => {
      setIsBoardLoading(true);
      setBoardSyncError("");
      setIsBoardReady(false);
      try {
        const response = await fetch(`/api/board?username=${DEMO_USERNAME}&board_id=${currentBoardId}`);
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
          setBoardSyncError("Unable to load board.");
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
  }, [isAuthed, currentBoardId]);

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
          body: JSON.stringify({ username: DEMO_USERNAME, board, board_id: currentBoardId }),
        });
        if (!response.ok) {
          throw new Error(`Failed to save board: ${response.status}`);
        }
        setBoardSyncError("");
      } catch {
        setBoardSyncError("Unable to save board.");
      }
    };
    void persistBoard();
  }, [board, isAuthed, isBoardReady, isBoardLoading, currentBoardId]);

  const sendChatMessage = async (message: string) => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    if (!message || isAiLoading) {
      return;
    }
    const historySnapshot = [...chatHistory];
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
          history: historySnapshot,
          board_id: currentBoardId,
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
      setLastAppliedSummary(data.assistantMessage);
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

  const handleSendChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendChatMessage(chatInput.trim());
  };

  const startListening = () => {
    if (!isVoiceSupported || !recognitionRef.current) {
      setVoiceError("Voice input is not supported on this browser.");
      setVoiceStatusMessage("Voice input is not supported on this browser.");
      return;
    }
    try {
      setVoiceError("");
      recognitionRef.current.start();
      setIsListening(true);
      setVoiceStatusMessage("Listening for voice command.");
    } catch {
      setVoiceError("Unable to start voice recognition.");
      setVoiceStatusMessage("Unable to start voice recognition.");
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setVoiceStatusMessage("Stopped listening.");
  };

  const clearTranscript = () => {
    setChatInput("");
    setLastTranscript("");
    setVoiceError("");
    setVoiceStatusMessage("Voice transcript cleared.");
  };

  const retryTranscript = () => {
    if (lastTranscript) {
      setChatInput(lastTranscript);
    }
    startListening();
  };

  const resendLastVoiceCommand = async () => {
    if (!lastVoiceCommand || isAiLoading) {
      return;
    }
    await sendChatMessage(lastVoiceCommand);
  };

  const createBoard = async () => {
    if (!newBoardTitle.trim()) {
      return;
    }
    setBoardActionError("");
    try {
      const response = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: DEMO_USERNAME, title: newBoardTitle.trim() }),
      });
      if (!response.ok) {
        throw new Error("Failed to create board.");
      }
      const data = (await response.json()) as { id: number; title: string; board: BoardData };
      setBoards((prev) => [...prev, { id: data.id, title: data.title, updated_at: new Date().toISOString() }]);
      setCurrentBoardId(data.id);
      skipNextSave.current = true;
      setBoard(data.board);
      setIsBoardReady(true);
      setNewBoardTitle("");
      setShowBoardForm(false);
    } catch {
      setBoardActionError("Failed to create board.");
    }
  };

  const switchBoard = (boardId: number) => {
    setCurrentBoardId(boardId);
  };

  const deleteBoard = async (boardId: number) => {
    setBoardActionError("");
    try {
      const response = await fetch(`/api/boards/${boardId}?username=${DEMO_USERNAME}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete board.");
      }
      const newBoards = boards.filter((b) => b.id !== boardId);
      setBoards(newBoards);
      if (newBoards.length > 0) {
        setCurrentBoardId(newBoards[0].id);
      }
    } catch {
      setBoardActionError("Failed to delete board.");
    }
  };

  const startRenameBoard = () => {
    const current = boards.find((b) => b.id === currentBoardId);
    if (current) {
      setRenameBoardTitle(current.title);
      setIsRenamingBoard(true);
      setBoardActionError("");
    }
  };

  const submitRenameBoard = async () => {
    if (!renameBoardTitle.trim() || !currentBoardId) {
      return;
    }
    setBoardActionError("");
    try {
      const response = await fetch(`/api/boards/${currentBoardId}?username=${DEMO_USERNAME}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameBoardTitle.trim() }),
      });
      if (!response.ok) {
        throw new Error("Failed to rename board.");
      }
      setBoards((prev) =>
        prev.map((b) =>
          b.id === currentBoardId ? { ...b, title: renameBoardTitle.trim() } : b,
        ),
      );
      setIsRenamingBoard(false);
    } catch {
      setBoardActionError("Failed to rename board.");
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
            {loginError ? (
              <p className="text-sm font-medium text-[var(--secondary-purple)]">{loginError}</p>
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

  const currentBoardInfo = (boards ?? []).find((b) => b.id === currentBoardId);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Navigation bar */}
      <nav className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[var(--navy-dark)] px-5">
        <h1 className="shrink-0 font-display text-base font-semibold tracking-wide text-white">
          Kanban Studio
        </h1>
        <div className="h-4 w-px shrink-0 bg-white/20" />

        {/* Board controls */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isBoardsLoading ? (
            <span className="text-xs text-white/50">Loading boards...</span>
          ) : showBoardForm ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void createBoard();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                placeholder="Board name"
                className="w-36 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs text-white placeholder-white/40 outline-none focus:border-white/40"
                aria-label="New board name"
                autoFocus
              />
              <button type="submit" className="text-xs font-semibold text-[var(--accent-yellow)]">
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBoardForm(false);
                  setNewBoardTitle("");
                }}
                className="text-xs font-semibold text-white/50 hover:text-white/80"
              >
                Cancel
              </button>
            </form>
          ) : isRenamingBoard ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitRenameBoard();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={renameBoardTitle}
                onChange={(e) => setRenameBoardTitle(e.target.value)}
                className="w-36 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs text-white placeholder-white/40 outline-none focus:border-white/40"
                aria-label="Rename board"
                autoFocus
              />
              <button type="submit" className="text-xs font-semibold text-[var(--accent-yellow)]">
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsRenamingBoard(false)}
                className="text-xs font-semibold text-white/50 hover:text-white/80"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <label htmlFor="board-select" className="sr-only">
                Select board
              </label>
              <select
                id="board-select"
                value={currentBoardId ?? ""}
                onChange={(e) => switchBoard(Number(e.target.value))}
                className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold text-white outline-none focus:border-white/40"
                aria-label="Select board"
              >
                {(boards ?? []).map((b) => (
                  <option key={b.id} value={b.id} className="bg-[var(--navy-dark)]">
                    {b.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={startRenameBoard}
                className="text-xs font-semibold text-white/60 hover:text-white"
                aria-label="Rename current board"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => setShowBoardForm(true)}
                className="text-xs font-semibold text-[var(--primary-blue)] hover:text-[var(--primary-blue)]/80"
                aria-label="Create new board"
              >
                + New
              </button>
              {(boards ?? []).length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (currentBoardId) {
                      void deleteBoard(currentBoardId);
                    }
                  }}
                  className="text-xs font-semibold text-white/40 hover:text-white/70"
                  aria-label="Delete current board"
                >
                  Delete
                </button>
              ) : null}
            </>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex shrink-0 items-center gap-3">
          {isBoardLoading ? (
            <span className="text-xs text-white/40">Syncing...</span>
          ) : boardSyncError ? (
            <span className="text-xs font-medium text-[var(--accent-yellow)]">{boardSyncError}</span>
          ) : null}
          {boardActionError ? (
            <span className="text-xs font-medium text-[var(--accent-yellow)]">{boardActionError}</span>
          ) : null}

          {/* AI panel toggle */}
          <button
            type="button"
            onClick={() => setShowAiPanel((prev) => !prev)}
            aria-pressed={showAiPanel}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              showAiPanel
                ? "bg-white/15 text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            AI Chat
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-white/40 hover:text-white"
          >
            Log out
          </button>
        </div>
      </nav>

      {/* Board title bar */}
      {currentBoardInfo && (
        <div className="flex h-10 shrink-0 items-center border-b border-[var(--stroke)] bg-white px-5">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            {currentBoardInfo.title}
          </span>
        </div>
      )}

      {/* Content area */}
      <div className="flex min-h-0 flex-1">
        {/* Main board */}
        <main className="min-w-0 flex-1 overflow-auto bg-[var(--surface)]">
          <KanbanBoard board={board} onBoardChange={setBoard} />
        </main>

        {/* AI Sidebar */}
        {showAiPanel && (
          <aside
            className="flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-[var(--stroke)] bg-white"
            aria-label="AI sidebar"
          >
            {/* Sidebar header */}
            <div className="shrink-0 border-b border-[var(--stroke)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                AI Assistant
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold text-[var(--navy-dark)]">
                Board Chat
              </h2>
            </div>

            {/* Chat history */}
            <div
              className="flex-1 space-y-3 overflow-y-auto p-4"
              data-testid="chat-history"
            >
              {chatHistory.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
                  <p className="text-sm text-[var(--gray-text)]">No messages yet.</p>
                  <p className="text-xs text-[var(--gray-text)]">
                    Try: &ldquo;Move the first card to Done&rdquo;
                  </p>
                </div>
              ) : (
                chatHistory.map((entry, index) => (
                  <div
                    key={`${entry.role}-${index}`}
                    className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                      entry.role === "user"
                        ? "ml-4 bg-[var(--navy-dark)] text-white"
                        : "mr-4 bg-[var(--surface)] text-[var(--navy-dark)]"
                    }`}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">
                      {entry.role === "user" ? "You" : "AI"}
                    </p>
                    <p>{entry.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Input area */}
            <div className="shrink-0 border-t border-[var(--stroke)] p-4">
              <form className="space-y-3" onSubmit={handleSendChat}>
                {isVoiceSupported ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={isListening ? stopListening : startListening}
                      aria-pressed={isListening}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                        isListening
                          ? "border-[var(--secondary-purple)] bg-[var(--secondary-purple)]/8 text-[var(--secondary-purple)]"
                          : "border-[var(--stroke)] text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
                      }`}
                    >
                      {isListening ? "Stop listening" : "Start listening"}
                    </button>
                    <button
                      type="button"
                      onClick={retryTranscript}
                      className="rounded-lg border border-[var(--stroke)] px-2.5 py-1 text-xs font-semibold text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={clearTranscript}
                      className="rounded-lg border border-[var(--stroke)] px-2.5 py-1 text-xs font-semibold text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={resendLastVoiceCommand}
                      disabled={!lastVoiceCommand || isAiLoading}
                      className="rounded-lg border border-[var(--stroke)] px-2.5 py-1 text-xs font-semibold text-[var(--navy-dark)] disabled:cursor-not-allowed disabled:opacity-50 hover:border-[var(--primary-blue)]"
                    >
                      Resend last voice command
                    </button>
                    {isListening ? (
                      <span className="text-xs font-medium text-[var(--secondary-purple)]">
                        Listening...
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--gray-text)]">Voice ready</span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--gray-text)]">
                    Voice input not supported on this browser.
                  </p>
                )}

                <div className="sr-only" aria-live="polite">
                  {voiceStatusMessage}
                </div>

                {voiceError ? (
                  <p className="rounded-lg bg-[var(--accent-yellow)]/15 px-3 py-2 text-xs font-medium text-[var(--navy-dark)]">
                    {voiceError}
                  </p>
                ) : null}

                <textarea
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  aria-label="Chat message"
                  rows={3}
                  placeholder="Move card-1 to Done"
                  className="w-full resize-none rounded-xl border border-[var(--stroke)] px-3 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                />

                {chatInput.trim() ? (
                  <p className="rounded-lg bg-[var(--surface)] px-3 py-2 text-xs text-[var(--gray-text)]">
                    Command preview: {chatInput}
                  </p>
                ) : null}

                {aiError ? (
                  <p className="rounded-lg bg-[var(--secondary-purple)]/8 px-3 py-2 text-xs font-medium text-[var(--secondary-purple)]">
                    {aiError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isAiLoading}
                  className="w-full rounded-xl bg-[var(--secondary-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAiLoading ? "Sending..." : "Send"}
                </button>

                {lastAppliedSummary ? (
                  <p className="rounded-lg border border-[var(--primary-blue)]/20 bg-[var(--primary-blue)]/8 px-3 py-2 text-xs text-[var(--navy-dark)]">
                    Last applied: {lastAppliedSummary}
                  </p>
                ) : null}
              </form>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
