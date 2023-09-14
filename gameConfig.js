import { } from 'dotenv/config';
import fs from 'fs';

const data = fs.readFileSync(`${process.env.GAME_FOLDER}/games.json`);
export var gameConfig = JSON.parse(data);
