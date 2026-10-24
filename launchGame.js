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

/**
 * Start a game for a command. In a text channel a new thread is made for the game; in a thread the
 * game is played right there.
 *
 * @param {object} interaction - The command interaction.
 * @param {object} game - The game's entry from games.json.
 * @return {Promise<{session: object}|{error: string}>} The running game, or why it could not start.
 */
export async function launchGame(interaction, game) {
    let channel = interaction.channel;

    if (sessions.get(channel.id)) {
        return { error: 'A game is already running here. Start another game in a different channel, or ask an admin to `/quit` this one.' };
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
        try {
            channel = await channel.threads.create({
                name: `${game.name} - ${player}`.slice(0, MAX_THREAD_NAME_LENGTH),
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
