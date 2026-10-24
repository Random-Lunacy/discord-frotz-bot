import path from 'path';
import { sessions } from './sessions.js';
import { Logger } from './logger.js';

/**
 * Describe a number of minutes for people, e.g. "90 minutes" or "2 hours".
 *
 * @param {number} minutes - A length of time.
 * @return {string} The description.
 */
export function describeMinutes(minutes) {
    if (minutes >= 60 && minutes % 60 === 0) {
        const hours = minutes / 60;
        return hours === 1 ? '1 hour' : `${hours} hours`;
    }
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

/**
 * Tell a thread its game was saved and shut down for being idle.
 *
 * @param {object} result
 * @param {object} result.session - The game that was stopped.
 * @param {string|null} result.savePath - Where it was saved, if it could be.
 */
export async function announceIdleStop({ session, savePath }) {
    const idle = describeMinutes(Math.round(sessions.idleTimeoutMs / 60_000));
    const name = session.game.name;
    const content = savePath
        ? `**${name}** was idle for ${idle}, so I saved it (\`${path.basename(savePath)}\`) and shut it down to free up resources. ` +
          'Use `/restore` in this thread to pick up where you left off.'
        : `**${name}** was idle for ${idle}, so I shut it down. It could not be saved, so anything since your last save is lost. ` +
          'Use `/restore` in this thread to go back to a save, or `/start` to begin again.';

    Logger.log({
        level: 'info',
        message: savePath
            ? `Auto-saved to ${savePath} and shut down idle game in ${session.channel.id}`
            : `Shut down idle game in ${session.channel.id} without a save`,
    });

    try {
        await session.channel.send({ content, allowedMentions: { parse: [] } });
    } catch (error) {
        Logger.log({
            level: 'error',
            message: `Could not post the idle shutdown notice in ${session.channel.id}: ${error.message}`,
            stack: error.stack,
        });
    }
}

/**
 * Start shutting down idle games, if an idle timeout is set.
 */
export function startIdleSweep() {
    if (!sessions.idleTimeoutMs) {
        Logger.log({
            level: 'info',
            message: 'Idle game shutdown is off (IDLE_TIMEOUT_MINUTES=0)',
        });
        return;
    }
    sessions.startIdleSweep(announceIdleStop);
}
