import { sessions } from '../sessions.js';
import { Logger } from '../logger.js';

const once = false;
const name = 'threadUpdate';

/**
 * Save the game in a thread when it is archived, then stop it, since nobody can play in the thread
 * any more. The save is named "autosave" and can be restored in the thread or a new one.
 *
 * @param {object} oldThread - The thread before the change.
 * @param {object} newThread - The thread after the change.
 */
async function invoke(oldThread, newThread) {
    if (oldThread.archived || !newThread.archived) {
        return;
    }

    try {
        const { stopped, savePath } = await sessions.autoSaveAndStop(newThread.id);
        if (stopped) {
            Logger.log({
                level: 'info',
                message: savePath
                    ? `Auto-saved to ${savePath} and stopped the game in archived thread ${newThread.id}`
                    : `Stopped the game in archived thread ${newThread.id} without a save`,
            });
        }
    } catch (error) {
        Logger.log({
            level: 'error',
            message: `Error saving the game in archived thread ${newThread.id}: ${error.message}`,
            stack: error.stack,
        });
    }
}

export { once, name, invoke };
