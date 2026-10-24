# discord-frotz-bot

<!-- ABOUT THE PROJECT -->

## About The Project

This project enables you to host and run interactive fiction games on Discord. Games are played by typing in a
channel, and the bot replies with the game's output. Games run on [rezrov-zmachine](https://github.com/Random-Lunacy/rezrov-zmachine),
a Z-machine interpreter written in TypeScript that runs inside the bot, so no external interpreter needs to be installed.
Most interactive fiction games with a `.z[number]` file extension (Z-machine versions 1-5) should work correctly.

<!-- GETTING STARTED -->

## Getting Started

Follow these steps to get a local copy of the bot up and running.

### Prerequisites

-   [Node.JS](https://nodejs.org/)

    Verify you have Node.js 22.12.0 or later installed:

    ```sh
    node --version
    ```

-   [NPM](https://www.npmjs.com/)

    Verify you have NPM installed:

    ```sh
    npm --version
    ```

-   [Git](https://git-scm.com/)

    Needed to fetch the Z-machine interpreter, which is not yet published to npm.

### Configure a Discord Bot Account

Follow the steps for [Creating a Bot Account](https://discord.readthedocs.io/en/stable/discord.html) and connecting it
to your Discord server.

Once you've created your bot account in Discord you will need to enable the **Message Content Intent** under **Bot** ->
**Privileged Gateway Intents**.

When building a URL to invite the bot account to a server select **Read Messages/View Channels** and **Send Messages**
under **Bot Permissions**.

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
5. Edit the `.env` file and replace `your-token-goes-here` with your bot token.
6. Copy the Z-machine games files you want your bot to use to the `games` folder.
7. Create a `games.json` file in the `games` folder from `games/games.json.template`.
    ```sh
    cp games/games.json.template games/games.json
    ```
8. Edit `games.json` to include for your Z-machine games. See `games/games.md` for more information.
9. Start the bot with `npm run start`

<!-- USAGE EXAMPLES -->

## Usage

The bot is controlled with slash commands. Only one game can run at a time.

| Command    | Description                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `/games`   | List the available games.                                                                         |
| `/channel` | Choose the channel the game is played in (defaults to the current channel).                       |
| `/start`   | Start a game.                                                                                     |
| `/restore` | Choose a save to restore. Can also start the game from a save if none is running.                 |
| `/pause`   | Pause or resume the bot's listening to the channel.                                               |
| `/status`  | Show the bot's current state.                                                                     |
| `/quit`    | Force the game to stop, for example if it is stuck. Progress since the last save is lost.         |

While a game is running, every message in the game channel is sent to the game as a command, so the game's own
`save`, `restore`, `undo` and `quit` commands all work.

-   **Saving:** type `save`. The bot asks the player who typed it to name the save (reply `skip` for no name or
    `cancel` to cancel). Only that player's reply is used; other messages are ignored until they answer or 60 seconds
    pass. Anyone in the channel can save.
-   **Restoring:** type `restore`. The bot lists the most recent saves for the running game, and only the player who
    typed `restore` can choose one (reply with a number, `latest` or `cancel`).
-   **Quitting:** type `quit` and answer the game's own confirmation. The bot notices when the game ends.

Saves are kept in the games folder and named `<game>-<channel>-<user>-<time>[-<name>].qzl`, with the Discord channel
and user IDs, the Unix time of the save, and the optional name the player gave it. Older saves named
`<game>-<time>-<user>.qzl` can still be restored.

For games that show a status line (Z-machine versions 1-3), the location, score and moves are shown above each reply.
Saves use the standard Quetzal (`.qzl`) format, so saves made by other interpreters, including Frotz, can be restored.

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
