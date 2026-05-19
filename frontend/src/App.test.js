import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the helper ai home screen", () => {
  render(<App />);
  expect(screen.getByText(/Welcome to Helper AI/i)).toBeInTheDocument();
  expect(screen.getAllByText(/New chat/i).length).toBeGreaterThan(0);
});
