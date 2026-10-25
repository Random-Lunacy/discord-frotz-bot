# discord-frotz-bot

A Discord bot that hosts Z-machine interactive fiction games, one game per Discord thread. Games run in-process on
[rezrov-zmachine](https://github.com/Random-Lunacy/rezrov-zmachine) (a TypeScript interpreter), which is linked as
`file:../rezrov-zmachine` and must be cloned and built (`npm run build`) next to this repo. The bot is plain ESM
JavaScript on Node 22.12+. See README.md for setup, configuration and usage.

## Commands

```sh
npm start         # run the bot (from the repo root: it reads ./events and ./logs)
npm test          # vitest
npm run lint      # eslint over *.js, events and tests (CI runs this)
npm run lint-fix
```

CI checks out and builds `rezrov-zmachine` as a sibling folder (see `.github/workflows/npm-test.yml`). The bot imports
rezrov's built `dist`, so rebuild it after changing rezrov.

## How it fits together

-   `frotz-bot.js` creates the Discord client and loads every file in `events/` as an event handler. Each exports
    `once`, `name` and `invoke`. `events/ready.js` registers the slash commands and starts the idle sweep.
-   `events/commands/*.js` are the slash commands. Each exports `create()` (the command definition) and `invoke()`.
    They are loaded by name, so a new command is just a new file. Descriptions are limited to 100 characters.
-   `events/interactionCreate.js` runs commands and routes channel messages to the game in that thread.
    `events/threadUpdate.js` autosaves and stops a game when its thread is archived; `events/threadDelete.js` stops it.
-   `sessions.js` is the registry of running games, keyed by thread ID (`GameSession` = thread, game, owner, paused flag,
    last activity, client). It also finds and shuts down idle games.
-   `launchGame.js` starts a game for `/start` and `/restore`: it finds or creates the thread, enforces `MAX_GAMES`, and
    starts the game. Threads are reused by name (`<game> - <player>`) or by the thread a save was made in.
-   `zmachineClient.js` (`ZMachineClient`) plays one game in one thread. It owns the interpreter, turns game output
    into Discord messages, asks players save/restore questions, and autosaves quietly (`silent` suppresses all
    messages). `discordScreen.js` and `discordInputProcessor.js` are its rezrov screen and input implementations.
-   `screenText.js` turns what a game draws into Discord text: a V4+ upper window becomes a status line (one row in
    reverse video across the whole width), a bold title (one row highlighted only around its text) or a
    code block (several rows), and aligned main-window paragraphs are put in code blocks. `DiscordScreen.flush()` uses
    it and only sends a status line or block again when it changes.
-   `keyPrompt.js` handles the Continue button the client posts when a game stops at "press any key" (found by
    `isAnyKeyPrompt` in `screenText.js`). `DiscordInputProcessor` presses Enter for any typed text at such a prompt and
    keeps the text as the next command. `restoreGame` and `autoSave` get past these prompts before typing `restore`/`save`.
-   `shutdown.js` handles SIGINT/SIGTERM: it autosaves every running game (`sessions.autoSaveAll`), posts a notice in each
    thread, closes the Discord client and exits (it gives up after 15 seconds, and a second signal exits at once).
-   `channelAccess.js` decides where commands work (`ALLOWED_CHANNELS`: listed channels, threads under them, threads with
    a game running; admins may use `/status` anywhere). `events/interactionCreate.js` checks it before running a command
    and replies privately when a command is refused.
-   `saves.js` builds, parses and lists save names: `<game>-<channel>-<user>-<time>[-<label>].qzl` (older saves are
    `<game>-<time>-<user>.qzl`). Game IDs must not contain hyphens.
-   `sharedData.js` holds config only (`client`, `gameFolder`, `gameList` from `games.json`). There is no global game state.

## Conventions

-   4-space indent, single quotes, semicolons (enforced by eslint). Match the surrounding comment density and JSDoc style.
-   Tests are in `tests/` (vitest, `globals: true`). Tests that play a real game skip unless `games/zork-i.z3` exists;
    they copy it to a temp folder and never touch real saves.
-   Mock `discord.js` builders with `function () { return {...}; }`, not arrow functions (vitest 4+ can't construct
    arrow-function mocks). `tests/commands.test.js` builds every command with the real builders to catch invalid
    definitions, so keep that passing when adding commands.
-   Never send anything to a thread while `client.silent` is true; the thread may be archived, and sending would reopen it.
-   `games/games.json`, game files and saves (`*.qzl`) are gitignored; never commit them.
