# Conductor Chrome Extension

Conductor is the Chrome-extension version of Operator AI Computer Control.

It keeps you in your normal Google Chrome window and normal signed-in profile. When Operator sends a task, Conductor opens the requested website in a new normal tab, then works there with extension permissions.

It stays linked to the Operator AI website so the website acts like the command center and the extension acts like the browser worker.

## What it does

- Uses your current Chrome window and profile
- Opens the requested site in a new normal tab
- Sends your request to the local Operator AI backend for planning
- Executes the browser steps in the workspace tab
- Opens the side panel on the workspace tab when Chrome allows it
- Keeps follow-up commands in the same workspace tab

## Example commands

- `Open YouTube then search Dhar Mann`
- `Open Amazon then look at track spikes`
- `Continue workspace and click the first result`
- `Summarize this page`
- `Search this page for pricing`
- `Fill email with sean@example.com`

## Safety rules

Conductor does not automatically:

- enter passwords or verification codes
- make purchases or enter payment details
- send emails or messages
- submit final forms
- delete content

If a request looks risky, the backend returns a blocked message instead of a plan.

## Setup

1. Start the Operator AI backend from this project.
2. Open Chrome.
3. Go to `chrome://extensions`.
4. Turn on `Developer mode`.
5. Click `Load unpacked`.
6. Select the `computer-control-extension` folder.
7. Pin `Conductor` to your toolbar.
8. Open any normal website in Chrome.
9. Click the Conductor extension icon.
10. Type a task and press `Run`.

## Backend requirement

The extension expects the Operator AI backend to be running at:

- `http://127.0.0.1:5050`

That backend endpoint is:

- `POST /computer/plan`

The extension uses it to turn natural-language requests into simple chronological browser steps.

## How it works

1. You type a browser task in Operator or in the extension popup.
2. The backend stores the task in a shared Computer Control session.
3. Conductor claims the next pending task from that shared session.
4. The backend planner returns either:
   - a direct message
   - or a step-by-step plan
5. If the plan starts with a site open, Conductor opens that website in a new normal tab.
6. After the page loads, Conductor tries to open its side panel on that tab.
7. `content.js` performs page actions like click, fill, search, scroll, and summarize.

## Current limitations

- Some websites with aggressive anti-automation or shadow-DOM-heavy UIs may need more site-specific selectors.
- The popup talks to the local backend, so the backend must be running first.
- `Close browser` is not handled by the extension yet.
