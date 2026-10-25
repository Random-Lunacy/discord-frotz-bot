// Save file naming and lookup.
//
// Save files are named <game>-<channel>-<user>-<time>[-<label>].qzl
//   game     game ID from games.json (letters and numbers only)
//   channel  Discord channel ID the game was played in
//   user     Discord user ID of the player who saved
//   time     Unix time (seconds) of the save
//   label    optional name given by the player (a-z, 0-9 and _)
//
// Saves made before channel and label were added are named <game>-<time>-<user>.qzl
import fs from 'fs';
import path from 'path';

const EXTENSION = '.qzl';
const MAX_LABEL_LENGTH = 32;

// Name given to a save when the player skips naming it or doesn't answer
export const DEFAULT_LABEL_TEMPLATE = '{user}_{date}_{time}';

/**
 * Reduce free text to a safe label for use in a file name.
 *
 * @param {string} text - Text typed by the player.
 * @return {string} Lower case letters, numbers and underscores, or '' if nothing usable remains.
 */
export function sanitizeLabel(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, MAX_LABEL_LENGTH);
}

/**
 * Fill in a label template. Placeholders are {game}, {user}, {channel}, {date} (YYYYMMDD)
 * and {time} (HHMM); the date and time are in the bot's local time zone.
 *
 * @param {string} template - Template such as '{user}_{date}_{time}'.
 * @param {object} values - Values for the placeholders; any missing ones are left empty.
 * @param {Date} [now] - The time to use for {date} and {time}.
 * @return {string} A sanitized label.
 */
export function expandLabelTemplate(template, values, now = new Date()) {
    const two = (n) => String(n).padStart(2, '0');
    const fields = {
        game: values.game ?? '',
        user: values.user ?? '',
        channel: values.channel ?? '',
        date: `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}`,
        time: `${two(now.getHours())}${two(now.getMinutes())}`,
    };

    return sanitizeLabel(
        String(template).replace(/\{(\w+)\}/g, (_, key) => fields[key] ?? '')
    );
}

/**
 * Build the file name for a save.
 *
 * @param {object} save - Details of the save.
 * @param {string} save.gameId - Game ID.
 * @param {string} save.channelId - Channel the game is being played in.
 * @param {string} save.userId - User who is saving.
 * @param {number} save.time - Unix time in seconds.
 * @param {string} [save.label] - Optional name for the save.
 * @return {string} The file name (without folder).
 */
export function buildSaveName({ gameId, channelId, userId, time, label }) {
    const fields = [gameId, channelId, userId, time];
    const safeLabel = sanitizeLabel(label);
    if (safeLabel) {
        fields.push(safeLabel);
    }
    return fields.join('-') + EXTENSION;
}

/**
 * Parse a save file name.
 *
 * @param {string} file - File name or path.
 * @return {object|null} The parts of the name, or null if it is not a save file.
 */
export function parseSaveName(file) {
    const name = path.basename(file);
    if (!name.endsWith(EXTENSION)) {
        return null;
    }

    const fields = name.slice(0, -EXTENSION.length).split('-');

    // <game>-<time>-<user> from before channel and label were added
    if (fields.length === 3 && /^\d{1,11}$/.test(fields[1])) {
        return {
            gameId: fields[0],
            channelId: null,
            userId: fields[2],
            time: parseInt(fields[1], 10),
            label: '',
        };
    }

    if (fields.length >= 4 && fields.length <= 5 && /^\d{1,11}$/.test(fields[3])) {
        return {
            gameId: fields[0],
            channelId: fields[1],
            userId: fields[2],
            time: parseInt(fields[3], 10),
            label: fields[4] ?? '',
        };
    }

    return null;
}

/**
 * List the saves for a game, newest first.
 *
 * @param {string} folder - Folder the saves are kept in.
 * @param {string} gameId - Game ID.
 * @return {object[]} Parsed saves, each with the full `path` added.
 */
export function listSaves(folder, gameId) {
    let files;
    try {
        files = fs.readdirSync(folder);
    } catch {
        return [];
    }

    return files
        .map((file) => {
            const parsed = parseSaveName(file);
            return parsed ? { ...parsed, path: `${folder}/${file}` } : null;
        })
        .filter((save) => save && save.gameId === gameId)
        .sort((a, b) => b.time - a.time);
}

/**
 * Put the saves made in a channel or thread ahead of the rest, keeping each group newest first.
 *
 * @param {object[]} saves - Saves from listSaves.
 * @param {string} channelId - The channel or thread to favour.
 * @return {object[]} A new list.
 */
export function preferChannel(saves, channelId) {
    return [
        ...saves.filter((save) => save.channelId === channelId),
        ...saves.filter((save) => save.channelId !== channelId),
    ];
}

/**
 * Work out which game a thread is for: the game of the newest save made in it, else the game its
 * name starts with ("<game name> - <player>", as the bot names threads).
 *
 * @param {string} folder - Folder the saves are kept in.
 * @param {object[]} games - The games from games.json.
 * @param {object} channel - The thread (needs `id` and `name`).
 * @return {object|null} The game, or null if it cannot be told.
 */
export function gameForChannel(folder, games, channel) {
    let newest = null;
    for (const game of games) {
        const save = listSaves(folder, game.id).find(
            (it) => it.channelId === channel.id
        );
        if (save && (!newest || save.time > newest.save.time)) {
            newest = { game, save };
        }
    }
    if (newest) {
        return newest.game;
    }

    // Longest name first, so "Zork II" is not mistaken for a game called "Zork"
    return (
        [...games]
            .sort((a, b) => b.name.length - a.name.length)
            .find((game) => channel.name?.startsWith(`${game.name} - `)) ?? null
    );
}

/**
 * Describe a save for a player: its name, who saved it and when, never the file name. The user and
 * the time use Discord markup, so they show as a name and in the reader's own time zone.
 *
 * @param {object} save - A save from parseSaveName or listSaves.
 * @param {object} [options]
 * @param {boolean} [options.user] - Include who saved it (default true).
 * @return {string} For example `"before the troll" saved by <@123> <t:1700000000:f>`.
 */
export function describeSave(save, { user = true } = {}) {
    const name = save.label ? `"${save.label}" ` : '';
    const by = user && save.userId ? `saved by <@${save.userId}> ` : '';
    return `${name}${by}<t:${save.time}:f>`;
}

/**
 * Describe the save in a file for a player (see describeSave), without ever showing the file name.
 *
 * @param {string} file - Path of a save file.
 * @param {object} [options] - Passed to describeSave.
 * @return {string} The description, or 'a save' if the name isn't one of ours.
 */
export function describeSavePath(file, options) {
    const save = parseSaveName(file);
    return save ? describeSave(save, options) : 'a save';
}
