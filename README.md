# LiftLog

A workout log that projects your next session. Runs on your iPhone as a home-screen app. No account, no server. Data stays on the phone.

## Deploy

1. Create a GitHub account and a new repository named `liftlog`.
2. Unzip `liftlog.zip`. Open the repository page, select **Add file**, then **Upload files**.
3. Drag the contents of the unzipped folder into the page. Include the `icons` folder. Do not include `tests`.
4. Select **Commit changes**.
5. Open **Settings**, then **Pages**. Set the source to your main branch and the root folder. Save.
6. Wait a minute. GitHub shows the site address, such as `https://yourname.github.io/liftlog/`.

## Install on iPhone

1. Open the site address in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open LiftLog from the home screen.

## Update

Replace the changed files in the repository. Close LiftLog completely and open it twice. The first open fetches the update. The second open runs it. Logged data stays.

## Backup

Open **Settings**, then **Export data**. Copy the text into a note or email it to yourself. Do this weekly.

## What it does now

- Picks the session from the weekday, then asks for location, food state, and whether you train that muscle again this week.
- Detects date and time. Records time of day, food state, and block order for every session.
- Splits the session into blocks. Each block shows exercises, sets, and targets.
- Gives single-number targets for exercises you did in the last 14 days.
- Gives a range for set 1 after a longer gap, an unknown date, or a swap. Sets 2 and later adjust after set 1.
- Lowers the target when set 1 falls short, and offers a lighter weight for more reps.
- Sets weekly volume per muscle. Fewer sets when you are unsure you will train it again.
- Caps a session at 60 minutes by trimming sets.
- Swaps an unavailable exercise in two taps. Picks substitutes by muscle and equipment.
- Uses a garage profile: barbell, rack, dumbbells to 80 lb, plate-loaded cable, Smith machine.
- Logs RPE, a momentum flag, and notes per exercise.
- Shows a summary after each session with records, items to improve, and weekly progress.
- Shows a home page with plain facts, weekly sets, an estimated-max chart, and past sessions.

## What it does not do yet

- The notes and questions box saves your text. It does not answer. Answers come from Claude in the chat.
- Free-text notes are stored but not parsed into tags.
- Context effects (time of day, food) start applying after four sessions in the same condition.
- RPE bias correction is not applied to projections. The summary reports it.
- The app does not check the 400 lb plate budget.

## Verify before relying on it

These values are my defaults. I have not checked them against sources.

- Weekly sets per muscle, per-session caps and minimums (Settings).
- Rep ranges per exercise (`data.js`).
- Strength ratios between exercises, such as barbell squat against hack squat (`data.js`, `rel`).
- Weekly strength gain of 0.5% and the gap penalty (`engine.js`).
- Set-to-set drop-off. The app learns it from your logs and starts from your Hevy numbers.

## Assumptions in the starting data

- The Hevy screens are treated as your last performed sessions. Pull is dated Oct 8 and Legs Sep 17, from the charts.
- The Push screens had no date. The app treats Push as a long gap.
- Bench Press (Barbell) starts at 205 × 9. That comes from what you told me, not from Hevy.
- The first Push exercise was cut off in the screenshot. It is not seeded.
- Seated Leg Curl had no data. It asks you to pick a weight.
- Weights are logged as you type them. Dumbbell weights are whatever you use in Hevy.
- The garage has a bench. Turn this off in Settings if not.
- Cable weights are plate weight. No pulley ratio.

## Files

- `index.html`, `styles.css`, `app.js`: interface.
- `engine.js`: projection and set logic.
- `data.js`: exercise list, session templates, starting data.
- `sw.js`, `manifest.webmanifest`, `icons/`: offline use and home-screen install.
- `tests/`: checks for the engine and the interface flow.
