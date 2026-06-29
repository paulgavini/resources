# Flashcard Study Web App

This is a vanilla HTML/CSS/JS flashcard page for a two-column NotebookLM CSV.

## Files

- `index.html` - the webpage
- `styles.css` - visual styling and print layout
- `app.js` - CSV import, multiple local decks, study controls, encouragement, progress, print, and Anki TSV export

## Use

Open `index.html` directly, or through a local or hosted web server. The app starts empty until a student imports a two-column CSV.

For a quick local preview:

```bash
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/
```

Students can also use the `+` button to import any two-column CSV from their own computer. Each imported CSV is saved as a separate local deck in IndexedDB.

## Controls

- Click the card or `See answer` to flip.
- Use the left and right arrows to move through cards.
- Mark `x` for review and `check` for known.
- Use the deck selector to switch between local decks.
- Use shuffle, print, export, or reset from the top toolbar.
- Progress is stored in IndexedDB in the browser on that device.

## Progress system

- Review: +1 XP and resets the streak.
- Known: +5 XP and adds to the streak.
- Every 5-card streak earns a small XP bonus.
- Getting a card right after it was previously marked for review earns a comeback bonus.
- Level increases every 50 XP.
- Emoji badges unlock privately for milestones such as first card, streaks, 10 mastered cards, half deck, full deck, and comeback cards.
- Hover over or focus an emoji badge to see what it means and how to unlock it.
- Encouragement messages appear after each response and are saved with the deck.

## Distribution

Recommended options:

- Host the folder in your LMS or school web space.
- Share the zip file with students and tell them to import the CSV if they open the file directly.
- Use the print button for a paper study handout.
- Use the export button to create an Anki-ready TSV.

## Local data

Decks and progress stay private to the current browser profile. There is no server sync, teacher dashboard, or public leaderboard. Students will lose local progress if they clear site data, use private browsing, or change device/browser.
