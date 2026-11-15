# App screenshots for the website

Drop full-screen iPhone screenshots (dark mode, 1206x2622) in here, then run `npm run build`:
the build makes each one in four sizes as WebP and the site picks the right one per slot.
Reference a screen in code with `<Phone screen="routine" … />` (add the name to `Screen` in
`src/site.ts` first).

Before a screenshot goes in:

- Cover the status bar (the time, signal and battery) with the screen's own background.
- Blur any clip thumbnail from the AI coach, so nobody in it can be recognised.
- Swap real pro players' photos for the app's initials badges. A real face on a marketing page
  can read as an endorsement, and the photos' licence needs a credit. Names and results are fine.

## In use

| File                  | Screen                                          |
| --------------------- | ----------------------------------------------- |
| dashboard.png         | Home                                            |
| live-scoring.png      | Live scoring, mid-frame                         |
| match-overview.png    | Match details                                   |
| share-card.png        | The share card, gold Century background         |
| record-snooker.png    | Record a Snooker in the camera                  |
| routine.png           | A routine drawn on the table                    |
| guide.png             | A guide (Stance and Balance)                     |
| rules.png             | Rules of snooker                                |
| routine-builder.png   | The routine builder                             |
| ai-coach.png          | AI coach report, top (thumbnail blurred)        |
| ai-coach-plan.png     | AI coach report: what to work on, routines      |
| stats.png             | Stats                                           |
| community.png         | Community home                                  |
| group.png, chat.png   | A group feed and chat                           |
| live-match.png        | Following a friend's match live                 |
| tournament.png        | A club tournament bracket                       |
| pro-tour-live.png     | Pro Tour: Live & results                        |
| pro-tour-bracket.png  | Pro Tour: a tournament's live final and bracket |
| rankings.png          | Pro Tour: money rankings                        |
| player-season.png     | Pro Tour: a player's season                     |
| coach-*.png, find-coach.png, session-notes.png | Coaching pages         |
