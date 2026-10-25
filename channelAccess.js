// Where the bot answers commands. By default it works in any channel; ALLOWED_CHANNELS limits it to
// some channels and the threads in them, so it doesn't make threads or post in channels where
// nobody wants it.
import { sessions } from './sessions.js';
import { isAdmin } from './permissions.js';

// Discord IDs are 17 to 20 digits
const CHANNEL_ID = /^\d{17,20}$/;

/**
 * Read ALLOWED_CHANNELS: channel IDs separated by commas, spaces or both.
 *
 * @return {{restricted: boolean, ids: string[], invalid: string[]}} `restricted` is true whenever
 *     the setting is used, even if none of its entries are valid IDs. Then nothing is allowed.
 */
export function channelRestrictions() {
    const entries = (process.env.ALLOWED_CHANNELS ?? '')
        .split(/[\s,]+/)
        .filter(Boolean);

    return {
        restricted: entries.length > 0,
        ids: entries.filter((entry) => CHANNEL_ID.test(entry)),
        invalid: entries.filter((entry) => !CHANNEL_ID.test(entry)),
    };
}

/**
 * Whether commands may be used in the place an interaction happened.
 *
 * Allowed: everywhere when no channels are set; a listed channel; a thread whose parent channel is
 * listed; and a thread that already has a game running (so a running game can always be paused or
 * stopped, even if the list has changed since it started).
 *
 * @param {object} interaction - The interaction.
 * @return {boolean} True if commands work here.
 */
export function isAllowedHere(interaction) {
    const { restricted, ids } = channelRestrictions();
    if (!restricted) {
        return true;
    }

    if (ids.includes(interaction.channelId)) {
        return true;
    }

    const channel = interaction.channel;
    if (channel?.isThread?.() && ids.includes(channel.parentId)) {
        return true;
    }

    return Boolean(sessions.get(interaction.channelId));
}

/**
 * Check a command against the allowed channels.
 *
 * @param {object} interaction - The command interaction.
 * @return {string|null} Why it is not allowed (a message for the user), or null if it is.
 */
export function channelDenial(interaction) {
    if (isAllowedHere(interaction)) {
        return null;
    }

    // An admin's /status is only ever shown to the admin, so it works anywhere
    if (interaction.commandName === 'status' && isAdmin(interaction)) {
        return null;
    }

    const { ids } = channelRestrictions();
    if (ids.length === 0) {
        return 'I\'m set up to only work in certain channels, but none of them are valid. Ask a server admin to check my configuration.';
    }

    const channels = ids.map((id) => `<#${id}>`).join(', ');
    return `Games can only be played in ${channels}, or in a thread in ${ids.length === 1 ? 'it' : 'one of them'}.`;
}
