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
        delete process.env.IDLE_TIMEOUT_MINUTES;
        sessions.stopIdleSweep();
        vi.useRealTimers();
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

    it('should save a game and then stop it', async () => {
        const session = sessions.create({ channel: channel('a'), game, ownerId: 'owner' });
        session.client.lastUserId = 'player';
        const autoSave = vi.spyOn(session.client, 'autoSave').mockResolvedValue('/games/x.qzl');
        const stop = vi.spyOn(session.client, 'stopGame');

        const result = await sessions.autoSaveAndStop('a');

        expect(autoSave).toHaveBeenCalledWith('player');
        expect(stop).toHaveBeenCalled();
        expect(result).toEqual({ stopped: true, savePath: '/games/x.qzl' });
        expect(sessions.get('a')).toBeUndefined();
    });

    it('should credit the owner when nobody has played yet', async () => {
        const session = sessions.create({ channel: channel('a'), game, ownerId: 'owner' });
        const autoSave = vi.spyOn(session.client, 'autoSave').mockResolvedValue(null);

        await sessions.autoSaveAndStop('a');

        expect(autoSave).toHaveBeenCalledWith('owner');
    });

    it('should stop the game even if saving it fails', async () => {
        const session = sessions.create({ channel: channel('a'), game, ownerId: 'owner' });
        vi.spyOn(session.client, 'autoSave').mockRejectedValue(new Error('disk full'));

        await expect(sessions.autoSaveAndStop('a')).rejects.toThrow('disk full');

        expect(sessions.get('a')).toBeUndefined();
    });

    it('should report that there was no game to stop', async () => {
        expect(await sessions.autoSaveAndStop('nowhere')).toEqual({
            stopped: false,
            savePath: null,
        });
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

    describe('idle games', () => {
        const MINUTE = 60_000;

        const idleFor = (session, minutes) => {
            session.lastActivity = Date.now() - minutes * MINUTE;
        };

        it('should time out after an hour by default, and 0 turns it off', () => {
            expect(sessions.idleTimeoutMs).toBe(60 * MINUTE);

            process.env.IDLE_TIMEOUT_MINUTES = '15';
            expect(sessions.idleTimeoutMs).toBe(15 * MINUTE);

            process.env.IDLE_TIMEOUT_MINUTES = '0';
            expect(sessions.idleTimeoutMs).toBe(0);
        });

        it('should ignore an invalid timeout', () => {
            process.env.IDLE_TIMEOUT_MINUTES = 'soon';
            expect(sessions.idleTimeoutMs).toBe(60 * MINUTE);

            process.env.IDLE_TIMEOUT_MINUTES = '-5';
            expect(sessions.idleTimeoutMs).toBe(60 * MINUTE);
        });

        it('should save and stop only the games idle for longer than the timeout', async () => {
            const stale = sessions.create({ channel: channel('stale'), game, ownerId: 'u1' });
            const fresh = sessions.create({ channel: channel('fresh'), game, ownerId: 'u2' });
            idleFor(stale, 61);
            idleFor(fresh, 59);
            vi.spyOn(stale.client, 'autoSave').mockResolvedValue('/games/stale-autosave.qzl');
            const freshSave = vi.spyOn(fresh.client, 'autoSave');

            const stopped = await sessions.stopIdle();

            expect(stopped).toEqual([
                { session: stale, savePath: '/games/stale-autosave.qzl' },
            ]);
            expect(sessions.get('stale')).toBeUndefined();
            expect(sessions.get('fresh')).toBe(fresh);
            expect(freshSave).not.toHaveBeenCalled();
        });

        it('should treat a paused game like any other idle game', async () => {
            const session = sessions.create({ channel: channel('a'), game, ownerId: 'u1' });
            session.paused = true;
            idleFor(session, 90);
            vi.spyOn(session.client, 'autoSave').mockResolvedValue(null);

            const stopped = await sessions.stopIdle();

            expect(stopped).toHaveLength(1);
            expect(stopped[0].savePath).toBeNull();
        });

        it('should not shut anything down when the timeout is 0', async () => {
            process.env.IDLE_TIMEOUT_MINUTES = '0';
            const session = sessions.create({ channel: channel('a'), game, ownerId: 'u1' });
            idleFor(session, 100000);

            expect(await sessions.stopIdle()).toEqual([]);
            expect(sessions.get('a')).toBe(session);
        });

        it('should keep shutting down other idle games when one fails', async () => {
            const bad = sessions.create({ channel: channel('bad'), game, ownerId: 'u1' });
            const good = sessions.create({ channel: channel('good'), game, ownerId: 'u1' });
            idleFor(bad, 120);
            idleFor(good, 120);
            vi.spyOn(bad.client, 'autoSave').mockRejectedValue(new Error('disk full'));
            vi.spyOn(good.client, 'autoSave').mockResolvedValue('/games/good.qzl');

            const stopped = await sessions.stopIdle();

            expect(stopped.map((it) => it.session)).toEqual([good]);
            expect(sessions.get('bad')).toBeUndefined();
        });

        it('should check on a timer and report each game it stops', async () => {
            vi.useFakeTimers();
            const session = sessions.create({ channel: channel('a'), game, ownerId: 'u1' });
            session.lastActivity = Date.now() - 120 * MINUTE;
            vi.spyOn(session.client, 'autoSave').mockResolvedValue('/games/a.qzl');
            const onStopped = vi.fn();

            sessions.startIdleSweep(onStopped, 1000);
            await vi.advanceTimersByTimeAsync(1000);

            expect(onStopped).toHaveBeenCalledWith({ session, savePath: '/games/a.qzl' });
        });
    });
});
