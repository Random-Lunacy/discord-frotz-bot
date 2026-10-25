import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSessions = { stop: vi.fn() };
const log = vi.fn();

vi.mock('../../sessions.js', () => ({ sessions: mockSessions }));
vi.mock('../../logger.js', () => ({ Logger: { log } }));

const { invoke, name, once } = await import('../../events/threadDelete.js');

describe('threadDelete event', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should listen for deleted threads, every time', () => {
        expect(name).toBe('threadDelete');
        expect(once).toBe(false);
    });

    it('should stop the game in a thread that is deleted, and log it', () => {
        mockSessions.stop.mockReturnValue(true);

        invoke({ id: 't1' });

        expect(mockSessions.stop).toHaveBeenCalledWith('t1');
        expect(log).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('t1') })
        );
    });

    it('should say nothing when the thread had no game', () => {
        mockSessions.stop.mockReturnValue(false);

        invoke({ id: 't2' });

        expect(log).not.toHaveBeenCalled();
    });
});
