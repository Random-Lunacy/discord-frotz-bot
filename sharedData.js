// Data shared across the bot
import { } from 'dotenv/config';
import fs from 'fs';

const data = fs.readFileSync(`${process.env.GAME_FOLDER}/games.json`);

// Define  shared data object
export const sharedData = {
    client: null,
    gameFolder: process.env.GAME_FOLDER,
    gameList: JSON.parse(data),
};
