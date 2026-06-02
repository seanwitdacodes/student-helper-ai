import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the simplified home screen", () => {
  render(<App />);
  expect(screen.getAllByText(/Operator AI/i).length).toBeGreaterThan(0);
  expect(
    screen.getAllByRole("button", { name: /Chat/i }).length,
  ).toBeGreaterThan(0);
  expect(
    screen.getAllByRole("button", { name: /Computer Control/i }).length,
  ).toBeGreaterThan(0);
});
