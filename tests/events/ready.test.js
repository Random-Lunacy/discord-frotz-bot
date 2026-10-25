import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockStartIdleSweep = vi.fn();
const log = vi.fn();
const commandFiles = vi.hoisted(() => ({ list: ['start.js', 'games.js', 'notes.txt'] }));

// Only the folder listing is faked; other modules still read files normally
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        default: { ...actual.default, readdirSync: vi.fn(() => commandFiles.list) },
    };
});
vi.mock('../../idleSweep.js', () => ({ startIdleSweep: mockStartIdleSweep }));
vi.mock('../../logger.js', () => ({ Logger: { log } }));
vi.mock('#commands/start', () => ({ create: () => ({ name: 'start' }) }));
vi.mock('#commands/games', () => ({ create: () => ({ name: 'games' }) }));

const { invoke, name, once } = await import('../../events/ready.js');

const GAMES = '1158820946925338686';

describe('ready event', () => {
    let client;

    beforeEach(() => {
        vi.clearAllMocks();
        client = {
            application: { commands: { set: vi.fn() } },
            user: { tag: 'Frotz-Dev#7385' },
        };
    });

    afterEach(() => {
        delete process.env.ALLOWED_CHANNELS;
    });

    it('should run once, when the bot has logged in', () => {
        expect(name).toBe('ready');
        expect(once).toBe(true);
    });

    it('should register every command file, and only command files', async () => {
        await invoke(client);

        expect(client.application.commands.set).toHaveBeenCalledWith([
            { name: 'start' },
            { name: 'games' },
        ]);
    });

    it('should start shutting down idle games', async () => {
        await invoke(client);

        expect(mockStartIdleSweep).toHaveBeenCalledTimes(1);
    });

    it('should log that it is logged in', async () => {
        await invoke(client);

        expect(log).toHaveBeenCalledWith({
            level: 'info',
            message: 'Successfully logged in as Frotz-Dev#7385!',
        });
    });

    it('should log nothing about channels when they are not restricted', async () => {
        await invoke(client);

        expect(log.mock.calls.filter(([entry]) => /channel/i.test(entry.message))).toEqual([]);
    });

    it('should log the channels it is restricted to', async () => {
        process.env.ALLOWED_CHANNELS = GAMES;

        await invoke(client);

        expect(log).toHaveBeenCalledWith({
            level: 'info',
            message: `Commands only work in channels ${GAMES} and the threads in them`,
        });
    });

    it('should log an error for entries that are not channel IDs, and keep the valid ones', async () => {
        process.env.ALLOWED_CHANNELS = `${GAMES},frotz`;

        await invoke(client);

        expect(log).toHaveBeenCalledWith(
            expect.objectContaining({ level: 'error', message: expect.stringContaining(GAMES) })
        );
        expect(log).toHaveBeenCalledWith(
            expect.objectContaining({
                level: 'error',
                message: expect.stringContaining('not channel IDs: frotz'),
            })
        );
    });

    it('should say loudly when none of the entries are valid', async () => {
        process.env.ALLOWED_CHANNELS = '#frotz-dev';

        await invoke(client);

        expect(log).toHaveBeenCalledWith(
            expect.objectContaining({
                level: 'error',
                message: expect.stringContaining('refused everywhere'),
            })
        );
    });
});
