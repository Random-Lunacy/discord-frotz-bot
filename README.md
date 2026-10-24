# discord-frotz-bot

<!-- ABOUT THE PROJECT -->

## About The Project

This project hosts interactive fiction games on Discord. Players type in a thread and the bot replies with the game's
output. Games run on [rezrov-zmachine](https://github.com/Random-Lunacy/rezrov-zmachine), a Z-machine interpreter
written in TypeScript that runs inside the bot, so no external interpreter needs to be installed. Most interactive
fiction games with a `.z[number]` file extension (Z-machine versions 1-5) should work correctly.

Features:

-   Each game is played in its own Discord thread, and several games can run at once.
-   Players save, restore and quit with the game's own commands. Saves are named for the game, thread, player and time,
    and use the standard Quetzal format, so saves from other interpreters (including Frotz) can be restored.
-   Games are saved automatically when their thread is archived or the game goes idle.
-   Slash commands for starting, restoring and pausing games, plus admin commands to see and stop every game.

<!-- GETTING STARTED -->

## Getting Started

Follow these steps to get a local copy of the bot up and running.

### Prerequisites

-   [Node.JS](https://nodejs.org/) 22.12.0 or later

    ```sh
    node --version
    ```

-   [NPM](https://www.npmjs.com/)

    ```sh
    npm --version
    ```

-   [Git](https://git-scm.com/)

    Needed to fetch the Z-machine interpreter, which is not yet published to npm.

### Configure a Discord Bot Account

Follow the steps for [Creating a Bot Account](https://discord.readthedocs.io/en/stable/discord.html) and connecting it
to your Discord server.

Once you've created your bot account in Discord you will need to enable the **Message Content Intent** under **Bot** ->
**Privileged Gateway Intents**, so the bot can read what players type.

When building a URL to invite the bot account to a server select these **Bot Permissions**:

-   **Read Messages/View Channels**
-   **Send Messages**
-   **Create Public Threads**
-   **Send Messages in Threads**

Each game is played in its own thread, so the bot needs to be able to create threads in the channels where people start
games.

Make note of your bot’s token, you will need to add it to the configuration for `discord-frotz-bot`. Note that this
token is essentially your bot’s password. You should never commit this token to the repository or share this token with
anyone else.

### Installation

1. Clone the bot and the interpreter side by side. The bot expects `rezrov-zmachine` in a sibling folder
   (it is referenced as `file:../rezrov-zmachine` in `package.json`).
    ```sh
    git clone https://github.com/Random-Lunacy/discord-frotz-bot.git
    git clone https://github.com/Random-Lunacy/rezrov-zmachine.git
    ```
2. Build the interpreter.
    ```sh
    cd rezrov-zmachine
    npm install
    npm run build
    cd ..
    ```
3. Install the bot's NPM packages.
    ```sh
    cd discord-frotz-bot
    npm install
    ```
4. Create a `.env` file in the repository root from `.env.template`.
    ```sh
    cp .env.template .env
    ```
5. Edit the `.env` file and replace `your-token-goes-here` with your bot token. The other settings are optional, see
   [Configuration](#configuration).
6. Copy the Z-machine games files you want your bot to use to the `games` folder.
7. Create a `games.json` file in the `games` folder from `games/games.json.template`.
    ```sh
    cp games/games.json.template games/games.json
    ```
8. Edit `games.json` to include your Z-machine games. See [games/games.md](games/games.md) for more information.
9. Start the bot from the repository root with `npm run start`. The slash commands are registered every time the bot
   starts and can take a minute to appear in Discord.

To update later, `git pull` in both folders, run `npm run build` in `rezrov-zmachine`, `npm install` in the bot, and
restart the bot.

### Configuration

Settings go in the `.env` file. Only the token and the game folder are required.

| Setting                | Default   | Description                                                                                                                                  |
| ---------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`        | -         | The bot's token.                                                                                                                             |
| `GAME_FOLDER`          | -         | Folder holding the game files, `games.json` and the saves, e.g. `./games`.                                                                   |
| `MAX_GAMES`            | `10`      | The most games that can run at once.                                                                                                         |
| `THREAD_LIFETIME_DAYS` | `7`       | Days a game's thread can go without messages before Discord archives it. `1`, `3` or `7`.                                                    |
| `IDLE_TIMEOUT_MINUTES` | `60`      | Minutes without a player message before a game is saved and shut down. `0` turns this off.                                                   |
| `DEFAULT_SAVE_NAME`    | `{user}_{date}_{time}` | Name given to a save when the player skips naming it. Placeholders: `{game}`, `{user}`, `{channel}`, `{date}` (YYYYMMDD) and `{time}` (HHMM). |

<!-- USAGE EXAMPLES -->

## Usage

The bot is controlled with slash commands. Server admins are users with the **Manage Server** permission.

| Command            | Who          | Description                                                                                                  |
| ------------------ | ------------ | ------------------------------------------------------------------------------------------------------------ |
| `/games`           | Anyone       | List the available games.                                                                                    |
| `/start`           | Anyone       | Start a game. See [Threads](#threads).                                                                       |
| `/restore`         | Anyone       | Restore a game from a save. See [Restoring](#saving-and-restoring).                                          |
| `/pause`           | Anyone       | Pause or resume the game in this thread (the bot stops or starts listening to messages).                     |
| `/status`          | Anyone       | Show the game in this thread. Server admins also see every game in progress, with who started it and when.   |
| `/status all:True` | Server admin | Show only the list of every game in progress.                                                                |
| `/quit`            | Server admin | Force the game in this thread to stop, for example if it is stuck. Progress since the last save is lost.     |

### Playing

While a game is running, every message in its thread is sent to the game as a command, so the game's own `save`,
`restore`, `undo` and `quit` commands all work. Players leave a game themselves by typing `quit` and answering the
game's own confirmation. For games that show a status line (Z-machine versions 1-3), the location, score and moves are
shown above each reply. `/pause` makes the bot ignore messages, which is useful in games where time advances.

### Threads

-   `/start` in a text channel plays the game in your thread for it. Threads are named `<game> - <player>`, and an
    existing one (reopened if it was archived) is used again instead of making another, so each player has their own
    thread for each game. If there isn't one, a new thread is created.
-   `/start` inside a thread plays the game in that thread, if it doesn't already have one.
-   At most `MAX_GAMES` games run at once. A game is stopped if its thread is deleted, and games do not survive a
    restart of the bot; saves do.

### Saving and restoring

-   **Saving:** type `save`. The bot asks the player who typed it to name the save. Reply with a name, `skip` to use
    the default name, or `cancel` to cancel. If there's no reply within 60 seconds the default name is used. Only that
    player's reply is used; other messages are ignored until they answer or the time runs out. Anyone in the thread
    can save.
-   **Restoring in a game:** type `restore`. The bot lists the most recent saves for the running game, those made in
    this thread first, and only the player who typed `restore` can choose one (reply with a number, `latest` or
    `cancel`).
-   **`/restore` in a thread with a game running:** pick a save to restore into it.
-   **`/restore` in a thread with no game running:** restores the game the thread was for (the game of its saves, else
    the game in its name) from the newest save made in that thread.
-   **`/restore` in a text channel:** pick a game, and its newest save is restored in your thread for it.

Saves are kept in the games folder and named `<game>-<channel>-<user>-<time>[-<name>].qzl`, with the Discord thread and
user IDs, the Unix time of the save, and the optional name the player gave it. Older saves named
`<game>-<time>-<user>.qzl` can still be restored.

### Automatic saves

Games are saved quietly, as an `autosave` that appears in the restore lists, in two cases:

-   **Idle:** after `IDLE_TIMEOUT_MINUTES` without a player message (or a `/pause` or `/restore`) the game is saved
    and shut down to free resources. A paused game counts as idle. The thread stays open and the bot says so there;
    use `/restore` in the thread to resume.
-   **Archived thread:** Discord archives a thread after `THREAD_LIFETIME_DAYS` without messages, whether or not the
    game is paused, and someone can also close it by hand. The game is saved first and then stopped. Use `/restore`
    in the thread or its channel to continue.

If a game cannot be saved (for example it is not responding) it is stopped without a save, so save before leaving a
game for a long time.

### Troubleshooting

| Problem                                       | Fix                                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| The bot logs in but ignores what players type | Enable the **Message Content Intent** for the bot in the Discord developer portal.                                    |
| "I could not create a thread here"            | Give the bot **Create Public Threads** and **Send Messages in Threads** in that channel.                              |
| Slash commands are missing or out of date     | Restart the bot, then wait a minute or reload Discord.                                                                 |
| "Failed to start game: Invalid Z-machine version" | The file isn't a Z-machine story file. Only Z-machine games (`.z1`-`.z8`, or Blorb files containing one) are supported. |
| The game says "Failed." when restoring        | The save is for a different game file or release, or the file is missing. The reason is in `logs/combined.log`.       |
| `Cannot find package 'rezrov-zmachine'`       | Clone and build `rezrov-zmachine` next to the bot (see Installation), then run `npm install` again.                   |

Logs are written to the console and to `logs/combined.log` and `logs/error.log`.

<!-- DEVELOPMENT -->

## Development

```sh
npm test            # run the tests
npm run coverage    # run the tests with a coverage report
npm run lint        # lint the code and tests
npm run lint-fix    # lint and fix what can be fixed
```

Some tests play a real game and are skipped unless `games/zork-i.z3` exists. Pull requests are checked on Node.js 22 and
24; the workflow checks out and builds `rezrov-zmachine` next to the bot. Rebuild `rezrov-zmachine` after changing it,
because the bot uses its built `dist` folder. See [CLAUDE.md](CLAUDE.md) for a tour of the code.

<!-- ROADMAP -->

## Roadmap

See the [open issues](https://github.com/Random-Lunacy/discord-frotz-bot/issues) for a full list of proposed features
(and known issues).

<!-- LICENSE -->

## License

Distributed under the MIT License. See `LICENSE` for more information.

<!-- CONTACT -->

## Contact

Project Link: [https://github.com/Random-Lunacy/discord-frotz-bot](https://github.com/Random-Lunacy/discord-frotz-bot)

<!-- ACKNOWLEDGMENTS -->

## Acknowledgments

-   [rezrov-zmachine](https://github.com/Random-Lunacy/rezrov-zmachine), the Z-machine interpreter that runs the games,
    and [ebozz](https://github.com/toshok/ebozz) by Chris Toshok, which it is based on.
-   Many thanks to the team who build and maintain [Frotz](https://661.org/proj/if/frotz/), which powered earlier
    versions of this bot.
