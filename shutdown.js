import { describeSavePath } from './saves.js';
import { sessions } from './sessions.js';
import { Logger } from './logger.js';

// How long to spend saving games before giving up and exiting anyway. Service managers such as
// systemd kill a process that takes longer than their own stop timeout (90 seconds by default).
const SHUTDOWN_TIMEOUT_MS = 15_000;

/**
 * Tell a thread its game was saved because the bot is stopping.
 *
 * @param {object} result
 * @param {object} result.session - The game that was stopped.
 * @param {string|null} result.savePath - Where it was saved, if it could be.
 */
export async function announceShutdown({ session, savePath }) {
    const name = session.game.name;
    const content = savePath
        ? `I'm shutting down or restarting, so I saved **${name}** as ${describeSavePath(savePath, { user: false })}. ` +
          'Use `/restore` in this thread to pick up where you left off once I\'m back.'
        : `I'm shutting down or restarting, and **${name}** could not be saved, so anything since your last save is lost. ` +
          'Use `/restore` in this thread to go back to a save once I\'m back.';

    try {
        await session.channel.send({ content, allowedMentions: { parse: [] } });
    } catch (error) {
        Logger.log({
            level: 'error',
            message: `Could not post the shutdown notice in ${session.channel.id}: ${error.message}`,
            stack: error.stack,
        });
    }
}

/**
 * Save every running game and tell its thread, giving up after a time limit.
 *
 * @param {number} [timeoutMs] - The most time to spend.
 * @return {Promise<{games: number, saved: number, timedOut: boolean}>} What happened.
 */
export async function shutdownGames(timeoutMs = SHUTDOWN_TIMEOUT_MS) {
    // Nothing should be shut down for being idle while everything is being shut down
    sessions.stopIdleSweep();

    const games = sessions.size;
    let saved = 0;

    const work = sessions.autoSaveAll().then(async (results) => {
        saved = results.filter((result) => result.savePath).length;
        await Promise.allSettled(results.map(announceShutdown));
    });

    let timer;
    const timedOut = await Promise.race([
        work.then(() => false),
        new Promise((resolve) => {
            timer = setTimeout(() => resolve(true), timeoutMs);
        }),
    ]);
    clearTimeout(timer);

    return { games, saved, timedOut };
}

/**
 * Make the function that handles a stop signal: save the games, close the Discord connection and
 * exit. A second signal while this is happening exits at once.
 *
 * @param {object} options
 * @param {object} options.client - The Discord client.
 * @param {function(number): void} [options.exit] - Exits the process.
 * @param {number} [options.timeoutMs] - The most time to spend saving games.
 * @return {function(string): Promise<void>} Called with the name of the signal.
 */
export function createShutdownHandler({ client, exit = process.exit, timeoutMs }) {
    let shuttingDown = false;

    return async (signal) => {
        if (shuttingDown) {
            Logger.log({
                level: 'warn',
                message: `Got ${signal} again while shutting down, exiting now`,
            });
            exit(1);
            return;
        }
        shuttingDown = true;

        Logger.log({
            level: 'info',
            message: `Got ${signal}, saving running games before exiting`,
        });

        try {
            const { games, saved, timedOut } = await shutdownGames(timeoutMs);
            Logger.log({
                level: timedOut ? 'warn' : 'info',
                message: timedOut
                    ? `Timed out saving games on shutdown (${saved} of ${games} saved)`
                    : `Saved ${saved} of ${games} running games`,
            });
        } catch (error) {
            Logger.log({
                level: 'error',
                message: `Error saving games on shutdown: ${error.message}`,
                stack: error.stack,
            });
        }

        try {
            await client.destroy();
        } catch {
            // Exiting anyway
        }
        exit(0);
    };
}

/**
 * Save running games when the bot is told to stop (Ctrl+C, `kill`, a service restart).
 *
 * @param {object} client - The Discord client.
 */
export function registerShutdownHandlers(client) {
    const handler = createShutdownHandler({ client });
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => handler(signal));
    }
}
