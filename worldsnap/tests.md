# WorldSnap — Manual Test Checklist

## Functional Tests

- [ ] Correct country guess on attempt 1 shows green result (🟩⬛⬛)
- [ ] Wrong guess on attempt 1 reveals hint #1 and marks first pip red
- [ ] Wrong guess on attempt 2 reveals hint #2 and marks second pip red
- [ ] After 3 wrong guesses, game ends, correct answer shown, result is 🟥🟥🟥
- [ ] `localStorage` saves today's result; reloading the page shows the "already played" banner
- [ ] "Already played" screen still shows the result card and share section
- [ ] Streak counter increments correctly when winning on consecutive days
- [ ] Streak counter resets to 0 when a day is skipped
- [ ] Streak counter does not increment again if page is reloaded after winning
- [ ] Date-based photo selection (`daysSinceEpoch % photos.length`) is consistent across page reloads and devices
- [ ] Searchable dropdown filters correctly and is case-insensitive (e.g. "japan" matches "Japan")
- [ ] Arrow keys (↑ ↓) navigate dropdown; Enter selects highlighted item
- [ ] Clicking outside the dropdown closes it
- [ ] Pressing Escape closes the dropdown
- [ ] Submitting a value not in the country list triggers a shake animation and shows a validation message
- [ ] Submitting an empty input triggers a shake animation
- [ ] Clipboard copy shows "✅ Copied to clipboard!" confirmation for 3 seconds
- [ ] Share emoji card format is correct: `WorldSnap 🌍 Day N\n<squares> Got it in X!\nPlay at: <url>`
- [ ] WhatsApp share button opens WhatsApp with a pre-filled message containing the game URL
- [ ] "Copy Link" button copies the game URL and shows "✅ Link copied!" confirmation
- [ ] Partial game progress (mid-game reload) restores guesses and hints correctly

## Cross-Device Tests

- [ ] Looks good on iPhone screen (375 px wide) — photo fills width, controls stack vertically, no horizontal scroll
- [ ] Looks good on desktop (1280 px wide) — content is centered with 640 px max-width
- [ ] Dropdown max-height scroll works on mobile
- [ ] Works on Chrome (latest)
- [ ] Works on Firefox (latest)
- [ ] Works on Safari (latest)

## Edge Case Tests

- [ ] `data/photos.json` fails to load → error screen with "⚠️ Couldn't load today's photo" and a Retry button appears
- [ ] Clicking Retry reloads the page
- [ ] Day 0 (epoch = 1 Jan 1970, dayNumber = 0): `0 % 15 = 0` → first photo entry (id: 1, Japan) loads correctly
- [ ] Day 14 wraps correctly: `14 % 15 = 14` → last entry (id: 15, Canada)
- [ ] Day 15 wraps back: `15 % 15 = 0` → first entry (Japan)
- [ ] Streak resets correctly if a player wins Monday, skips Tuesday, plays again Wednesday — Wednesday shows streak = 1
- [ ] Player who won yesterday but lost today retains yesterday's streak count until midnight (streak is only reset for future days)
- [ ] `localStorage` entry from a previous day is ignored and a fresh game starts

## Result Card Format Reference

**Win on attempt 1:**
```
WorldSnap 🌍 Day 42
🟩⬛⬛ Got it in 1!
Play at: https://alinadeemwork.github.io/copilotAgents/worldsnap
```

**Win on attempt 3:**
```
WorldSnap 🌍 Day 42
🟥🟥🟩 Got it in 3!
Play at: https://alinadeemwork.github.io/copilotAgents/worldsnap
```

**All 3 attempts failed:**
```
WorldSnap 🌍 Day 42
🟥🟥🟥 Better luck tomorrow!
Play at: https://alinadeemwork.github.io/copilotAgents/worldsnap
```
