# discord-frotz-bot

A Discord bot that hosts Z-machine interactive fiction games, one game per Discord thread. Games run in-process on
[rezrov-zmachine](https://github.com/Random-Lunacy/rezrov-zmachine) (a TypeScript interpreter), installed from npm as
`@random-lunacy/rezrov-zmachine`. See README.md for setup, configuration and usage, and docs/deployment.md for running it on a
server.

## Gotchas

-   rezrov-zmachine comes from npm (`@random-lunacy/rezrov-zmachine`). To try an unreleased interpreter change, build
    a local checkout and temporarily point `package.json` at it with `file:../rezrov-zmachine`; don't commit that.
-   Run the bot from the repo root: it reads `./events`, `./games` and `./logs`. In a service or script run
    `node ./frotz-bot.js` directly, not `npm start`: npm does not pass a stop signal on, so the shutdown autosave
    (`shutdown.js`) would not run.
-   There is no global game state. Each game is a `GameSession` (`sessions.js`) with its own `ZMachineClient`, keyed by
    thread ID. `sharedData.js` holds config only.
-   Save names are `<game>-<channel>-<user>-<time>[-<label>].qzl` and are parsed by splitting on hyphens, so game IDs
    must not contain hyphens. Older saves are `<game>-<time>-<user>.qzl`.
-   `restoreGame` and `autoSave` must get past "press any key" prompts before typing `restore`/`save`, or the word is
    taken as a keypress.
-   Never send anything to a thread while `client.silent` is true (autosaving a game in an archived thread): sending
    would reopen the thread.
-   Slash command descriptions are limited to 100 characters. `tests/commands.test.js` builds every command with the real
    builders, so keep it passing when adding commands.

## Conventions

-   4-space indent, single quotes, semicolons (enforced by eslint, which CI runs over `tests/` too). Match the
    surrounding comment density and JSDoc style.
-   CI has no `.env` and no game files, but a developer machine usually has both, so a test can pass locally and fail on CI
    (a real module reading `GAME_FOLDER` is the usual cause). To see what CI sees, run
    `env -u GAME_FOLDER DOTENV_CONFIG_PATH=/nonexistent npx vitest run`, with `games/` moved aside if you want the
    game-file tests skipped too.
-   Tests that play a real game skip unless `games/zork-i.z3` exists; they copy it to a temp folder and never touch real
    saves.
-   Mock `discord.js` builders with `function () { return {...}; }`, not arrow functions (vitest 4+ can't construct
    arrow-function mocks).
-   `games/games.json`, game files and saves (`*.qzl`) are gitignored; never commit them.
