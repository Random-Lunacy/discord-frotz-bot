## Configuring Games

Place games files in this folder (or in the folder you specified with `GAME_FOLDER` in `.env`).  Game files should connform to the Z-Machine standard. V1-V5 files are supported.

Create a `games.json` file int the the folder using `games.json.template` as a template

Create an entry for each game file, with the following values set for each game. 

- `id`: Short game identifier (e.g. "game1").  The ID must  contain only letters and numbers. 
- `name`: Descriptive name for the game (e.g. "The Game: A Cool Text Adventure"). 256 characters max. 
- `file`: Game data file (e.g. "game.z3").
