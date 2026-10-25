import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSessions = {
    idleTimeoutMs: 2 * 60 * 60_000,
    startIdleSweep: vi.fn(),
};
const log = vi.fn();

vi.mock('../sessions.js', () => ({ sessions: mockSessions }));
vi.mock('../logger.js', () => ({ Logger: { log } }));

const { announceIdleStop, describeMinutes, startIdleSweep } = await import('../idleSweep.js');

describe('describeMinutes', () => {
    it.each([
        [1, '1 minute'],
        [45, '45 minutes'],
        [60, '1 hour'],
        [120, '2 hours'],
        [90, '90 minutes'],
    ])('should describe %i minutes as %s', (minutes, text) => {
        expect(describeMinutes(minutes)).toBe(text);
    });
});

describe('announceIdleStop', () => {
    let session;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSessions.idleTimeoutMs = 2 * 60 * 60_000;
        session = {
            game: { name: 'Zork I' },
            channel: { id: 't1', send: vi.fn().mockResolvedValue({}) },
        };
    });

    it('should describe the save in friendly terms, not by its file name', async () => {
        await announceIdleStop({
            session,
            savePath: '/games/zork1-555-123-1700000000-autosave.qzl',
        });

        const { content, allowedMentions } = session.channel.send.mock.calls[0][0];
        expect(content).toContain('**Zork I** was idle for 2 hours');
        expect(content).toContain('"autosave" <t:1700000000:f>');
        expect(content).not.toContain('.qzl');
        expect(content).not.toContain('zork1-555');
        expect(content).toContain('`/restore`');
        expect(allowedMentions).toEqual({ parse: [] });
    });

    it('should not fail on a save file whose name it cannot read', async () => {
        await announceIdleStop({ session, savePath: '/games/odd.qzl' });

        const { content } = session.channel.send.mock.calls[0][0];
        expect(content).toContain('saved it as a save');
        expect(content).not.toContain('odd.qzl');
    });

    it('should warn when the game could not be saved', async () => {
        await announceIdleStop({ session, savePath: null });

        const { content } = session.channel.send.mock.calls[0][0];
        expect(content).toContain('could not be saved');
        expect(content).toContain('`/start`');
    });

    it('should log rather than throw when the notice cannot be posted', async () => {
        session.channel.send.mockRejectedValue(new Error('Missing Access'));

        await expect(
            announceIdleStop({ session, savePath: null })
        ).resolves.toBeUndefined();

        expect(log).toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
    });
});

describe('startIdleSweep', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should start sweeping when there is a timeout', () => {
        startIdleSweep();

        expect(mockSessions.startIdleSweep).toHaveBeenCalledWith(announceIdleStop);
    });

    it('should not sweep when the timeout is off', () => {
        mockSessions.idleTimeoutMs = 0;

        startIdleSweep();

        expect(mockSessions.startIdleSweep).not.toHaveBeenCalled();
    });
});
