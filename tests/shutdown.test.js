import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSessions = {
    size: 0,
    stopIdleSweep: vi.fn(),
    autoSaveAll: vi.fn(),
};
const log = vi.fn();

vi.mock('../sessions.js', () => ({ sessions: mockSessions }));
vi.mock('../logger.js', () => ({ Logger: { log } }));

const { announceShutdown, createShutdownHandler, shutdownGames } = await import('../shutdown.js');

const session = (name, send = vi.fn().mockResolvedValue({})) => ({
    game: { name },
    channel: { id: `${name}-thread`, send },
});

describe('announceShutdown', () => {
    it('should describe the save in friendly terms, not by its file name', async () => {
        const s = session('Zork I');

        await announceShutdown({
            session: s,
            savePath: '/games/zork1-555-123-1700000000-autosave.qzl',
        });

        const { content, allowedMentions } = s.channel.send.mock.calls[0][0];
        expect(content).toContain('saved **Zork I** as "autosave" <t:1700000000:f>');
        expect(content).not.toContain('.qzl');
        expect(content).not.toContain('/games/');
        expect(content).toContain('`/restore`');
        expect(allowedMentions).toEqual({ parse: [] });
    });

    it('should warn when the game could not be saved', async () => {
        const s = session('Zork I');

        await announceShutdown({ session: s, savePath: null });

        expect(s.channel.send.mock.calls[0][0].content).toContain('could not be saved');
    });

    it('should log rather than throw when the notice cannot be posted', async () => {
        const s = session('Zork I', vi.fn().mockRejectedValue(new Error('Missing Access')));

        await expect(announceShutdown({ session: s, savePath: null })).resolves.toBeUndefined();

        expect(log).toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
    });
});

describe('shutdownGames', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSessions.size = 2;
    });

    it('should stop the idle sweep, save every game and tell each thread', async () => {
        const a = session('Zork I');
        const b = session('Sorcerer');
        mockSessions.autoSaveAll.mockResolvedValue([
            { session: a, savePath: '/games/zork1-1-2-3-autosave.qzl' },
            { session: b, savePath: null },
        ]);

        const result = await shutdownGames();

        expect(mockSessions.stopIdleSweep).toHaveBeenCalled();
        expect(result).toEqual({ games: 2, saved: 1, timedOut: false });
        expect(a.channel.send).toHaveBeenCalledTimes(1);
        expect(b.channel.send).toHaveBeenCalledTimes(1);
    });

    it('should give up when saving takes too long', async () => {
        mockSessions.autoSaveAll.mockReturnValue(new Promise(() => {}));

        const result = await shutdownGames(20);

        expect(result.timedOut).toBe(true);
    });

    it('should cope with no games running', async () => {
        mockSessions.size = 0;
        mockSessions.autoSaveAll.mockResolvedValue([]);

        expect(await shutdownGames()).toEqual({ games: 0, saved: 0, timedOut: false });
    });
});

describe('createShutdownHandler', () => {
    let client;
    let exit;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSessions.size = 0;
        mockSessions.autoSaveAll.mockResolvedValue([]);
        client = { destroy: vi.fn().mockResolvedValue(undefined) };
        exit = vi.fn();
    });

    it('should save the games, disconnect and exit cleanly', async () => {
        const handler = createShutdownHandler({ client, exit });

        await handler('SIGTERM');

        expect(mockSessions.autoSaveAll).toHaveBeenCalled();
        expect(client.destroy).toHaveBeenCalled();
        expect(exit).toHaveBeenCalledWith(0);
    });

    it('should exit at once on a second signal', async () => {
        mockSessions.autoSaveAll.mockReturnValue(new Promise(() => {}));
        const handler = createShutdownHandler({ client, exit, timeoutMs: 1000 });

        handler('SIGINT');
        await handler('SIGINT');

        expect(exit).toHaveBeenCalledWith(1);
        expect(mockSessions.autoSaveAll).toHaveBeenCalledTimes(1);
    });

    it('should still exit if saving throws', async () => {
        mockSessions.autoSaveAll.mockRejectedValue(new Error('boom'));
        const handler = createShutdownHandler({ client, exit });

        await handler('SIGTERM');

        expect(log).toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
        expect(exit).toHaveBeenCalledWith(0);
    });

    it('should still exit if disconnecting fails', async () => {
        client.destroy.mockRejectedValue(new Error('already closed'));
        const handler = createShutdownHandler({ client, exit });

        await handler('SIGTERM');

        expect(exit).toHaveBeenCalledWith(0);
    });
});
