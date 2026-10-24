// The games currently being played, one per Discord channel or thread.
import { ZMachineClient } from './zmachineClient.js';
import { Logger } from './logger.js';

const DEFAULT_MAX_GAMES = 10;
const DEFAULT_IDLE_TIMEOUT_MINUTES = 60;
const SWEEP_INTERVAL_MS = 60_000;

/**
 * A game being played in a channel or thread.
 */
export class GameSession {
    /**
     * @param {object} options
     * @param {object} options.channel - The Discord channel or thread the game is played in.
     * @param {object} options.game - The game's entry from games.json.
     * @param {string} options.ownerId - The Discord user who started the game.
     */
    constructor({ channel, game, ownerId }) {
        this.channel = channel;
        this.game = game;
        this.ownerId = ownerId;
        this.startedAt = Date.now();
        this.lastActivity = this.startedAt;
        this.paused = false;
        this.client = new ZMachineClient({
            channel,
            gameId: game.id,
            gameName: game.name,
        });
    }

    touch() {
        this.lastActivity = Date.now();
    }
}

/**
 * Registry of running games, keyed by channel or thread ID.
 */
export class GameSessions {
    constructor() {
        this.sessions = new Map();
    }

    get maxGames() {
        const configured = parseInt(process.env.MAX_GAMES, 10);
        return configured > 0 ? configured : DEFAULT_MAX_GAMES;
    }

    /**
     * How long a game can go without a player message before it is saved and shut down, from
     * IDLE_TIMEOUT_MINUTES (0 turns this off).
     *
     * @return {number} Milliseconds, or 0 if games are never shut down for being idle.
     */
    get idleTimeoutMs() {
        const minutes = parseInt(process.env.IDLE_TIMEOUT_MINUTES, 10);
        return (minutes >= 0 ? minutes : DEFAULT_IDLE_TIMEOUT_MINUTES) * 60_000;
    }

    get size() {
        return this.sessions.size;
    }

    isFull() {
        return this.sessions.size >= this.maxGames;
    }

    get(channelId) {
        return this.sessions.get(channelId);
    }

    list() {
        return [...this.sessions.values()];
    }

    /**
     * Register a new game. The session is removed again when its game ends.
     *
     * @return {GameSession} The new session.
     */
    create(options) {
        const session = new GameSession(options);
        this.sessions.set(session.channel.id, session);
        session.client.on('end', () => this.remove(session.channel.id));
        return session;
    }

    /**
     * Stop a game, if one is running, and forget it.
     *
     * @param {string} channelId - The channel or thread the game is in.
     * @return {boolean} False if there was no game.
     */
    stop(channelId) {
        const session = this.sessions.get(channelId);
        if (!session) {
            return false;
        }
        session.client.stopGame();
        this.sessions.delete(channelId);
        return true;
    }

    /**
     * Save a game quietly, then stop it. If it cannot be saved it is stopped anyway.
     *
     * @param {string} channelId - The channel or thread the game is in.
     * @return {Promise<{stopped: boolean, savePath: string|null}>} Whether there was a game, and where it was saved.
     */
    async autoSaveAndStop(channelId) {
        const session = this.sessions.get(channelId);
        if (!session) {
            return { stopped: false, savePath: null };
        }

        let savePath = null;
        try {
            savePath = await session.client.autoSave(
                session.client.lastUserId ?? session.ownerId
            );
        } finally {
            this.stop(channelId);
        }
        return { stopped: true, savePath };
    }

    /**
     * Save and stop every game that has been idle for longer than the idle timeout. One game
     * failing to save does not stop the others being shut down.
     *
     * @param {number} [now] - The current time in milliseconds.
     * @return {Promise<{session: GameSession, savePath: string|null}[]>} The games that were stopped.
     */
    async stopIdle(now = Date.now()) {
        const timeout = this.idleTimeoutMs;
        if (!timeout) {
            return [];
        }

        const stopped = [];
        for (const session of this.list()) {
            if (now - session.lastActivity < timeout) {
                continue;
            }
            try {
                const result = await this.autoSaveAndStop(session.channel.id);
                if (result.stopped) {
                    stopped.push({ session, savePath: result.savePath });
                }
            } catch (error) {
                Logger.log({
                    level: 'error',
                    message: `Error shutting down idle game in ${session.channel.id}: ${error.message}`,
                    stack: error.stack,
                });
            }
        }
        return stopped;
    }

    /**
     * Check for idle games once a minute and tell the callback about each one that was shut down.
     *
     * @param {function(object): Promise<void>} onStopped - Called with {session, savePath}.
     * @param {number} [intervalMs] - How often to check.
     */
    startIdleSweep(onStopped, intervalMs = SWEEP_INTERVAL_MS) {
        this.stopIdleSweep();

        let sweeping = false;
        this.sweepTimer = setInterval(async () => {
            if (sweeping) {
                return;
            }
            sweeping = true;
            try {
                for (const result of await this.stopIdle()) {
                    await onStopped(result);
                }
            } catch (error) {
                Logger.log({
                    level: 'error',
                    message: `Error checking for idle games: ${error.message}`,
                    stack: error.stack,
                });
            } finally {
                sweeping = false;
            }
        }, intervalMs);
        this.sweepTimer.unref?.();
    }

    stopIdleSweep() {
        clearInterval(this.sweepTimer);
        this.sweepTimer = null;
    }

    remove(channelId) {
        this.sessions.delete(channelId);
    }
}

export const sessions = new GameSessions();
