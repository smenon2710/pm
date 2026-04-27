import { expect, test, type Page } from "@playwright/test";

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

const setupBoardApiMock = async (page: Page) => {
  let boardStore = JSON.parse(JSON.stringify(boardFixture));
  const columnById = (id: string) =>
    boardStore.columns.find((column: { id: string }) => column.id === id);
  await page.route("**/api/board**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ username: "user", board: boardStore }),
      });
      return;
    }
    if (request.method() === "PUT") {
      const payload = request.postDataJSON() as { board: typeof boardStore };
      boardStore = payload.board;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fallback();
  });
  await page.route("**/api/ai/board", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.fallback();
      return;
    }
    const payload = request.postDataJSON() as { message?: string };
    const message = (payload.message ?? "").toLowerCase();

    if (message.includes("move card-1")) {
      const backlog = columnById("col-backlog");
      const done = columnById("col-done");
      if (backlog && done) {
        backlog.cardIds = backlog.cardIds.filter((id: string) => id !== "card-1");
        done.cardIds = ["card-1", ...done.cardIds.filter((id: string) => id !== "card-1")];
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          assistantMessage: "Moved card-1 to done.",
          operations: [
            {
              type: "move_card",
              cardId: "card-1",
              fromColumnId: "col-backlog",
              toColumnId: "col-done",
              position: 0,
            },
          ],
          board: boardStore,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assistantMessage: "No board changes needed.",
        operations: [],
        board: boardStore,
      }),
    });
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
  await expect(page.getByText("Moved card-1 to done.")).toBeVisible();
});
