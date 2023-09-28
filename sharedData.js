// sharedData.js
import { } from 'dotenv/config';
import fs from 'fs';

const data = fs.readFileSync(`${process.env.GAME_FOLDER}/games.json`);

// Define  shared data object
export const sharedData = {
    client: null,
    gameId: null,
    channel: null,
    gameFolder: process.env.GAME_FOLDER,
    gameList: JSON.parse(data),
    playingGame: false,
    gameActive: false,
    // Add more properties as needed
};
