// Data shared across the bot
import { } from 'dotenv/config';
import fs from 'fs';
import { Frotz } from './frotzClient.js';

const data = fs.readFileSync(`${process.env.GAME_FOLDER}/games.json`);

// Define  shared data object
export const sharedData = {
    client: null,
    gameId: null,
    channel: null,
    thread: null,
    gameFolder: process.env.GAME_FOLDER,
    gameList: JSON.parse(data),
    listenToGame: false,
    gameActive: false,
    frotzClient: Frotz,
};
