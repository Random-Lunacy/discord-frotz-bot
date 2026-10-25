import fs from 'fs';
import { Logger } from '../logger.js';
import { startIdleSweep } from '../idleSweep.js';
import { channelRestrictions } from '../channelAccess.js';

const once = true;
const name = 'ready';

/**
 * Invokes the client by loading commands from the './events/commands' directory
 * and sets them as application commands. It also logs a success message after
 * the client is logged in.
 *
 * @param {Object} client - The client object representing the Discord bot.
 * @return {Promise<void>} - A promise that resolves once the commands are set.
 */
async function invoke(client) {
    const commands = fs
        .readdirSync('./events/commands')
        .filter((file) => file.endsWith('.js'))
        .map((file) => file.slice(0, -3));

    const commandsArray = [];

    for (let command of commands) {
        const commandFile = await import(`#commands/${command}`);
        commandsArray.push(commandFile.create());
    }

    client.application.commands.set(commandsArray);

    startIdleSweep();

    const { restricted, ids, invalid } = channelRestrictions();
    if (restricted) {
        Logger.log({
            level: invalid.length || !ids.length ? 'error' : 'info',
            message: ids.length
                ? `Commands only work in channels ${ids.join(', ')} and the threads in them`
                : 'ALLOWED_CHANNELS has no valid channel IDs, so commands are refused everywhere',
        });
        if (invalid.length) {
            Logger.log({
                level: 'error',
                message: `Ignoring entries in ALLOWED_CHANNELS that are not channel IDs: ${invalid.join(', ')}`,
            });
        }
    }

    Logger.log({
        level: 'info',
        message: `Successfully logged in as ${client.user.tag}!`
    });
}

export { once, name, invoke };
