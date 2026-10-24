import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../sharedData.js', () => ({ sharedData: { gameFolder: '/games' } }));

const { GameSessions } = await import('../sessions.js');

const channel = (id) => ({ id, send: vi.fn().mockResolvedValue({}) });
const game = { id: 'zork1', name: 'Zork I', file: 'zork-i.z3' };

describe('GameSessions', () => {
    let sessions;

    beforeEach(() => {
        sessions = new GameSessions();
    });

    afterEach(() => {
        delete process.env.MAX_GAMES;
    });

    it('should keep a game for each channel', () => {
        sessions.create({ channel: channel('a'), game, ownerId: 'u1' });
        sessions.create({ channel: channel('b'), game, ownerId: 'u2' });

        expect(sessions.size).toBe(2);
        expect(sessions.get('a').ownerId).toBe('u1');
        expect(sessions.get('b').ownerId).toBe('u2');
        expect(sessions.get('c')).toBeUndefined();
        expect(sessions.list()).toHaveLength(2);
    });

    it('should give each game its own client', () => {
        const a = sessions.create({ channel: channel('a'), game, ownerId: 'u1' });
        const b = sessions.create({ channel: channel('b'), game, ownerId: 'u1' });

        expect(a.client).not.toBe(b.client);
        expect(a.client.channel.id).toBe('a');
        expect(b.client.channel.id).toBe('b');
    });

    it('should forget a game when it ends', () => {
        const session = sessions.create({ channel: channel('a'), game, ownerId: 'u1' });

        session.client.emit('end');

        expect(sessions.get('a')).toBeUndefined();
    });

    it('should stop and forget a game', () => {
        const session = sessions.create({ channel: channel('a'), game, ownerId: 'u1' });
        const stop = vi.spyOn(session.client, 'stopGame');

        expect(sessions.stop('a')).toBe(true);
        expect(stop).toHaveBeenCalled();
        expect(sessions.get('a')).toBeUndefined();
        expect(sessions.stop('a')).toBe(false);
    });

    it('should limit the number of games, 10 by default', () => {
        expect(sessions.maxGames).toBe(10);

        process.env.MAX_GAMES = '2';
        sessions.create({ channel: channel('a'), game, ownerId: 'u1' });
        expect(sessions.isFull()).toBe(false);
        sessions.create({ channel: channel('b'), game, ownerId: 'u1' });
        expect(sessions.isFull()).toBe(true);
    });

    it('should ignore an invalid MAX_GAMES', () => {
        process.env.MAX_GAMES = 'lots';

        expect(sessions.maxGames).toBe(10);
    });
});
