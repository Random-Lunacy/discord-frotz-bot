# discord-frotz-bot

<!-- ABOUT THE PROJECT -->

## About The Project

This project enables you to host and run interactive fiction games on Discord using [Frotz](https://661.org/proj/if/frotz/), a popular Z-machine interpreter. Most interactive fiction games with a `.z[number]`
file extension should work correctly.

<!-- GETTING STARTED -->

## Getting Started

This is an example of how you may give instructions on setting up your project locally.
To get a local copy up and running follow these simple example steps.

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

-   [Frotz](https://661.org/proj/if/frotz/)

    This bot uses the `dfrotz` implementation of Frotz to run the interactive fiction games. Verify your Frotz installation by running the following command:

    ```sh
    dfrotz -v
    ```

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

1. Clone the repo.
    ```sh
    git clone https://github.com/Random-Lunacy/discord-frotz-bot.git
    ```
2. Install NPM packages.
    ```sh
    cd discord-frotz-bot
    npm install
    ```
3. Create a `.env` file in the repository root from `.env.template`.
    ```sh
    cp .env.template .env
    ```
4. Edit the `.env` file and replace `your-token-goes-here` with your bot token.
5. Copy the Z-machine games files you want your bot to use to the `games` folder.
6. Create a `games.json` file in the `games` folder from `games/games.json.template`.
    ```sh
    cp games/games.json.template games/games.json
    ```
7. Edit `games.json` to include for your Z-machine games. See `games/games.md` for more information.
8. Start the bot with `npm run start`

<!-- USAGE EXAMPLES -->

## Usage

TODO: Add examples of how to use the bot.

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

-   Many thanks to the team who build and maintain [Frotz](https://661.org/proj/if/frotz/). Without their work
    this bot would not be possible.
