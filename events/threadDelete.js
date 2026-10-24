import { sessions } from '../sessions.js';
import { Logger } from '../logger.js';

const once = false;
const name = 'threadDelete';

/**
 * Stop the game in a thread that has been deleted.
 *
 * @param {object} thread - The deleted thread.
 */
function invoke(thread) {
    if (sessions.stop(thread.id)) {
        Logger.log({
            level: 'info',
            message: `Stopped the game in deleted thread ${thread.id}`,
        });
    }
}

export { once, name, invoke };
