import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the study studio shell", () => {
  render(<App />);
  expect(screen.getByText(/Student Helper/i)).toBeInTheDocument();
  expect(screen.getAllByText(/New chat/i).length).toBeGreaterThan(0);
});
