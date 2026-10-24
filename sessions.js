// The games currently being played, one per Discord channel or thread.
import { ZMachineClient } from './zmachineClient.js';

const DEFAULT_MAX_GAMES = 10;

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

    remove(channelId) {
        this.sessions.delete(channelId);
    }
}

export const sessions = new GameSessions();
