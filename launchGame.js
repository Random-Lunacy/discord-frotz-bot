import { ChannelType } from 'discord.js';
import { sessions } from './sessions.js';
import { Logger } from './logger.js';

// Threads close themselves after a period without messages. Discord allows 1 hour, 1 day, 3 days
// or 7 days; the bot offers the days.
const DEFAULT_THREAD_LIFETIME_DAYS = 7;
const THREAD_LIFETIME_MINUTES = { 1: 1440, 3: 4320, 7: 10080 };
const MAX_THREAD_NAME_LENGTH = 100;

/**
 * How long a game's thread stays open without messages, from THREAD_LIFETIME_DAYS (1, 3 or 7).
 *
 * @return {number} The lifetime in minutes, as Discord's autoArchiveDuration.
 */
export function threadLifetimeMinutes() {
    const days = parseInt(process.env.THREAD_LIFETIME_DAYS, 10);
    return (
        THREAD_LIFETIME_MINUTES[days] ??
        THREAD_LIFETIME_MINUTES[DEFAULT_THREAD_LIFETIME_DAYS]
    );
}

const safely = async (lookup) => {
    try {
        return await lookup();
    } catch {
        return null;
    }
};

/**
 * Make an archived thread usable again.
 *
 * @param {object} thread - The thread.
 * @return {Promise<boolean>} False if it could not be reopened (for example it is locked).
 */
async function reopen(thread) {
    if (!thread.archived) {
        return true;
    }
    try {
        await thread.setArchived(false);
        return true;
    } catch {
        return false;
    }
}

/**
 * Find an existing thread in the command's channel to play in, instead of making a new one: the
 * thread a save was made in, else an open or archived thread already named for this game and player. A thread
 * that already has a game running is never reused.
 *
 * @param {object} interaction - The command interaction.
 * @param {string} name - The name a new thread for this game and player would get.
 * @param {string} [threadId] - The thread to prefer, such as the one a save was made in.
 * @return {Promise<object|null>} The thread, or null if there is none to reuse.
 */
async function findReusableThread(interaction, name, threadId) {
    const parent = interaction.channel;
    const usable = (thread) =>
        thread?.isThread?.() && thread.parentId === parent.id && !sessions.get(thread.id);

    if (threadId) {
        const thread = await interaction.guild?.channels.fetch(threadId).catch(() => null);
        if (usable(thread) && (await reopen(thread))) {
            return thread;
        }
    }

    const matches = (thread) => thread.name === name && usable(thread);

    const active = await safely(() => parent.threads.fetchActive());
    const open = active?.threads.find(matches);
    if (open) {
        return open;
    }

    // A thread that closed itself is as good as an open one
    const archived = await safely(() =>
        parent.threads.fetchArchived({ type: 'public', limit: 100 })
    );
    const closed = archived?.threads.find(matches);
    return closed && (await reopen(closed)) ? closed : null;
}

/**
 * Start a game for a command. In a text channel a new thread is made for the game; in a thread the
 * game is played right there.
 *
 * @param {object} interaction - The command interaction.
 * @param {object} game - The game's entry from games.json.
 * @param {object} [options]
 * @param {boolean} [options.reuse] - Play in an existing thread of this channel if there is a matching one.
 * @param {string} [options.threadId] - With `reuse`, the thread to prefer, such as the one a save was made in.
 * @return {Promise<{session: object}|{error: string}>} The running game, or why it could not start.
 */
export async function launchGame(interaction, game, { reuse = false, threadId } = {}) {
    let channel = interaction.channel;

    if (sessions.get(channel.id)) {
        return { error: 'A game is already running in this thread. Use `/start` in a text channel to play in a thread of your own, or ask an admin to `/quit` this one.' };
    }

    if (sessions.isFull()) {
        return { error: `The bot is already running its maximum of ${sessions.maxGames} games. Try again when one has ended.` };
    }

    let createdThread = false;
    if (!channel.isThread()) {
        if (!channel.threads) {
            return { error: 'Games can only be played in a text channel or thread.' };
        }

        const player = interaction.member?.displayName ?? interaction.user.username;
        const name = `${game.name} - ${player}`.slice(0, MAX_THREAD_NAME_LENGTH);

        const existing = reuse
            ? await findReusableThread(interaction, name, threadId)
            : null;

        if (existing) {
            channel = existing;
        } else {
            try {
                channel = await channel.threads.create({
                    name,
                    type: ChannelType.PublicThread,
                    autoArchiveDuration: threadLifetimeMinutes(),
                    reason: `${player} started ${game.name}`,
                });
                createdThread = true;
            } catch (error) {
                Logger.log({
                    level: 'error',
                    message: `Could not create a thread for ${game.id}: ${error.message}`,
                    stack: error.stack,
                });
                return { error: 'I could not create a thread here. I need the Create Public Threads and Send Messages in Threads permissions.' };
            }
        }

        // Make sure the player who started the game is in the thread
        await channel.members.add(interaction.user.id).catch(() => {});
    }

    const session = sessions.create({
        channel,
        game,
        ownerId: interaction.user.id,
    });

    if (!session.client.startGame(game.file)) {
        const message = session.client.lastError.message;
        sessions.remove(channel.id);
        if (createdThread) {
            await channel.delete().catch(() => {});
        }
        return { error: message };
    }

    return { session };
}
