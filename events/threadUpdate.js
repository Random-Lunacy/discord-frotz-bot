import { sessions } from '../sessions.js';
import { Logger } from '../logger.js';

const once = false;
const name = 'threadUpdate';

/**
 * Stop the game in a thread when it is archived, since nobody can play in it any more.
 * Saved games are kept, so the game can be restored in a new thread.
 *
 * @param {object} oldThread - The thread before the change.
 * @param {object} newThread - The thread after the change.
 */
function invoke(oldThread, newThread) {
    if (!oldThread.archived && newThread.archived && sessions.stop(newThread.id)) {
        Logger.log({
            level: 'info',
            message: `Stopped the game in archived thread ${newThread.id}`,
        });
    }
}

export { once, name, invoke };
