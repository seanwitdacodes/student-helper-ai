import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the simplified home screen", () => {
  render(<App />);
  expect(screen.getAllByText(/Operator/i).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", { name: /Chat/i }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", { name: /Computer Mode/i }).length).toBeGreaterThan(0);
});
