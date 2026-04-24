import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";

describe("Home auth gate", () => {
  beforeEach(() => {
    window.localStorage.clear();
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

    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
    expect(screen.getByText("Kanban Studio")).toBeInTheDocument();
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

    const firstColumnTitle = screen.getAllByLabelText("Column title")[0];
    await userEvent.clear(firstColumnTitle);
    await userEvent.type(firstColumnTitle, "Saved Column");
    expect(firstColumnTitle).toHaveValue("Saved Column");

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getAllByLabelText("Column title")[0]).toHaveValue("Saved Column");
  });
});
