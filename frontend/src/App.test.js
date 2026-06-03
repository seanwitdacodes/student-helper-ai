import { render, screen } from "@testing-library/react";
import App from "./App";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

test("renders the simplified home screen", () => {
  render(<App />);
  expect(
    screen.getByRole("heading", { name: /operator/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText(/Type @ for connectors and sources/i),
  ).toBeInTheDocument();
  expect(screen.getByText(/Search/i)).toBeInTheDocument();
});
