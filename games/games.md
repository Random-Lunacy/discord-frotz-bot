## Configuring Games

Place game files in this folder (or in the folder you specified with `GAME_FOLDER` in `.env`). Saves are kept in the
same folder. Game files should conform to the Z-Machine standard. V1-V5 files are supported (V6-V8 are not yet
reliable), as are Blorb files that contain a Z-machine story.

Create a `games.json` file in the folder using `games.json.template` as a template.

Create an entry for each game file, with the following values set for each game. You can add up to 25 games, which is
the most Discord allows in a command's list of choices.

-   `id`: Short game identifier (e.g. "game1"). The ID must contain only letters and numbers: it is part of each
    save's file name, which is split on hyphens.
-   `name`: Descriptive name for the game (e.g. "The Game: A Cool Text Adventure"). 100 characters or fewer, which is
    Discord's limit for the name of a command choice. It is also used in thread names (`<name> - <player>`) and to work
    out which game a thread is for.
-   `file`: Game data file (e.g. "game.z3").

Saves are matched to a game by its `id`, so don't reuse an `id` for a different game. A save that doesn't belong to the
game file (a different game, release or serial number) is refused when restoring: the game says "Failed." and carries
on, and the reason is written to the log.

Restart the bot after changing `games.json`.
