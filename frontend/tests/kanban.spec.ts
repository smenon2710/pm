import { expect, test, type Page, type Route } from "@playwright/test";

declare global {
  interface Window {
    SpeechRecognition: new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((event: unknown) => void) | null;
      onerror: ((event: unknown) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    __emitSpeechTranscript: (transcript: string) => void;
  }
}

const boardFixture = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    { id: "col-progress", title: "In Progress", cardIds: ["card-4", "card-5"] },
    { id: "col-review", title: "Review", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": {
      id: "card-1",
      title: "Align roadmap themes",
      details: "Draft quarterly themes with impact statements and metrics.",
    },
    "card-2": {
      id: "card-2",
      title: "Gather customer signals",
      details: "Review support tags, sales notes, and churn feedback.",
    },
    "card-3": {
      id: "card-3",
      title: "Prototype analytics view",
      details: "Sketch initial dashboard layout and key drill-downs.",
    },
    "card-4": {
      id: "card-4",
      title: "Refine status language",
      details: "Standardize column labels and tone across the board.",
    },
    "card-5": {
      id: "card-5",
      title: "Design card layout",
      details: "Add hierarchy and spacing for scanning dense lists.",
    },
    "card-6": {
      id: "card-6",
      title: "QA micro-interactions",
      details: "Verify hover, focus, and loading states.",
    },
    "card-7": {
      id: "card-7",
      title: "Ship marketing page",
      details: "Final copy approved and asset pack delivered.",
    },
    "card-8": {
      id: "card-8",
      title: "Close onboarding sprint",
      details: "Document release notes and share internally.",
    },
  },
};

type BoardCard = { id: string; title: string; details: string };
type BoardStore = {
  columns: { id: string; title: string; cardIds: string[] }[];
  cards: Record<string, BoardCard>;
};

const fulfillJson = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

const setupBoardApiMock = async (page: Page) => {
  let boardStore: BoardStore = structuredClone(boardFixture);
  const columnById = (id: string) => boardStore.columns.find((column) => column.id === id);

  await page.route("**/api/board**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await fulfillJson(route, { username: "user", board: boardStore });
      return;
    }
    if (request.method() === "PUT") {
      const payload = request.postDataJSON() as { board: BoardStore };
      boardStore = payload.board;
      await fulfillJson(route, { ok: true });
      return;
    }
    await route.fallback();
  });

  await page.route("**/api/ai/board", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const payload = route.request().postDataJSON() as { message?: string };
    const message = (payload.message ?? "").toLowerCase();

    if (message.includes("move card-1")) {
      const backlog = columnById("col-backlog");
      const done = columnById("col-done");
      if (backlog && done) {
        backlog.cardIds = backlog.cardIds.filter((id) => id !== "card-1");
        done.cardIds = ["card-1", ...done.cardIds.filter((id) => id !== "card-1")];
      }
    }
    if (message.includes("rename")) {
      const backlog = columnById("col-backlog");
      if (backlog) backlog.title = "AI Renamed";
    }
    if (message.includes("create")) {
      boardStore.cards["card-voice"] = {
        id: "card-voice",
        title: "Voice card",
        details: "Created from voice command.",
      };
      const backlog = columnById("col-backlog");
      if (backlog && !backlog.cardIds.includes("card-voice")) {
        backlog.cardIds.push("card-voice");
      }
    }
    if (message.includes("edit card-2")) {
      boardStore.cards["card-2"] = {
        ...boardStore.cards["card-2"],
        title: "Signals Updated",
        details: "Updated via voice",
      };
    }
    if (message.includes("delete card-3")) {
      delete boardStore.cards["card-3"];
      boardStore.columns = boardStore.columns.map((column) => ({
        ...column,
        cardIds: column.cardIds.filter((id) => id !== "card-3"),
      }));
    }

    let assistantMessage = "Applied requested updates.";
    if (message.includes("move card-1") && message.includes("rename")) {
      assistantMessage = "Moved card-1 and renamed backlog.";
    } else if (message.includes("move card-1")) {
      assistantMessage = "Moved card-1 to done.";
    } else if (message.includes("rename")) {
      assistantMessage = "Renamed backlog column.";
    }

    await fulfillJson(route, { assistantMessage, operations: [], board: boardStore });
  });
};

const setupMockSpeechRecognition = async (page: Page) => {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "en-US";
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      static latest: MockSpeechRecognition | null = null;
      constructor() {
        MockSpeechRecognition.latest = this;
      }
      start() {}
      stop() {
        this.onend?.();
      }
    }
    window.SpeechRecognition = MockSpeechRecognition;
    window.__emitSpeechTranscript = (transcript) => {
      MockSpeechRecognition.latest?.onresult?.({
        resultIndex: 0,
        results: [{ 0: { transcript }, isFinal: true, length: 1 }],
      });
    };
  });
};

const login = async (page: Page, navigate = true) => {
  if (navigate) {
    await page.goto("/");
  }
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
};

test("loads the kanban board", async ({ page }) => {
  await setupBoardApiMock(page);
  await login(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await setupBoardApiMock(page);
  await login(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await page.setViewportSize({ width: 1900, height: 1100 });
  await setupBoardApiMock(page);
  await login(page);
  const card = page.getByTestId("card-card-1");
  const targetCardInReview = page.getByTestId("card-card-6");
  const cardBox = await card.boundingBox();
  const targetCardBox = await targetCardInReview.boundingBox();
  if (!cardBox || !targetCardBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    targetCardBox.x + targetCardBox.width / 2,
    targetCardBox.y + targetCardBox.height / 2,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-1")).toBeVisible();
});

test("blocks board before login and supports logout", async ({ page }) => {
  await setupBoardApiMock(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).not.toBeVisible();

  await login(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByLabel("Column title").fill("Persist Me");
  await expect(firstColumn.getByLabel("Column title")).toHaveValue("Persist Me");

  await expect(page.getByRole("button", { name: /log out/i })).toBeVisible();
  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

  await login(page, false);
  await expect(firstColumn.getByLabel("Column title")).toHaveValue("Persist Me");
});

test("keeps board changes after page reload", async ({ page }) => {
  await setupBoardApiMock(page);
  await login(page);

  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByLabel("Column title").fill("Reload Persisted");
  await expect(firstColumn.getByLabel("Column title")).toHaveValue("Reload Persisted");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(firstColumn.getByLabel("Column title")).toHaveValue("Reload Persisted");
});

test("applies AI chat board mutation in UI", async ({ page }) => {
  await setupBoardApiMock(page);
  await login(page);

  await expect(page.getByRole("complementary", { name: /ai sidebar/i })).toBeVisible();
  await page.getByLabel("Chat message").fill("Move card-1 to done");
  await page.getByRole("button", { name: /^send$/i }).click();

  const doneColumn = page.getByTestId("column-col-done");
  await expect(doneColumn.getByTestId("card-card-1")).toBeVisible();
  await expect(page.getByTestId("chat-history").getByText("Moved card-1 to done.")).toBeVisible();
});

test("voice transcript executes move and rename flow", async ({ page }) => {
  await setupMockSpeechRecognition(page);
  await setupBoardApiMock(page);
  await login(page);

  await page.getByRole("button", { name: /start listening/i }).click();
  await page.evaluate(() => {
    window.__emitSpeechTranscript("Move card-1 to done and rename backlog");
  });
  await page.getByRole("button", { name: /^send$/i }).click();

  await expect(page.getByTestId("column-col-done").getByTestId("card-card-1")).toBeVisible();
  await expect(page.getByLabel("Column title").first()).toHaveValue("AI Renamed");
});

test("voice transcript executes create edit delete flow", async ({ page }) => {
  await setupMockSpeechRecognition(page);
  await setupBoardApiMock(page);
  await login(page);

  await page.getByRole("button", { name: /start listening/i }).click();
  await page.evaluate(() => {
    window.__emitSpeechTranscript("Create card edit card-2 and delete card-3");
  });
  await page.getByRole("button", { name: /^send$/i }).click();

  await expect(page.getByText("Voice card")).toBeVisible();
  await expect(page.getByText("Signals Updated")).toBeVisible();
  await expect(page.getByTestId("card-card-3")).toHaveCount(0);
});

test("voice command preview and resend action work", async ({ page }) => {
  await setupMockSpeechRecognition(page);
  await setupBoardApiMock(page);
  await login(page);

  await page.getByRole("button", { name: /start listening/i }).click();
  await page.evaluate(() => {
    window.__emitSpeechTranscript("Rename backlog");
  });

  await expect(page.getByText(/command preview:/i)).toBeVisible();
  await page.getByRole("button", { name: /resend last voice command/i }).click();
  await expect(page.getByLabel("Column title").first()).toHaveValue("AI Renamed");
  await expect(page.getByText(/last applied:/i)).toBeVisible();
});
