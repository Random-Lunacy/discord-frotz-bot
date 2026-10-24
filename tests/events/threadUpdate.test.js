import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSessions = { autoSaveAndStop: vi.fn() };
const log = vi.fn();

vi.mock('../../sessions.js', () => ({ sessions: mockSessions }));
vi.mock('../../logger.js', () => ({ Logger: { log } }));

const { invoke, name } = await import('../../events/threadUpdate.js');

describe('threadUpdate event', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSessions.autoSaveAndStop.mockResolvedValue({
            stopped: true,
            savePath: '/games/zork1-1-2-3-autosave.qzl',
        });
    });

    it('should listen for thread updates', () => {
        expect(name).toBe('threadUpdate');
    });

    it('should save and stop the game when its thread is archived', async () => {
        await invoke({ id: 't1', archived: false }, { id: 't1', archived: true });

        expect(mockSessions.autoSaveAndStop).toHaveBeenCalledWith('t1');
        expect(log).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('Auto-saved') })
        );
    });

    it('should say when the game could not be saved', async () => {
        mockSessions.autoSaveAndStop.mockResolvedValue({ stopped: true, savePath: null });

        await invoke({ id: 't1', archived: false }, { id: 't1', archived: true });

        expect(log).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('without a save') })
        );
    });

    it('should ignore updates that do not archive the thread', async () => {
        await invoke({ id: 't1', archived: false }, { id: 't1', archived: false });
        await invoke({ id: 't1', archived: true }, { id: 't1', archived: false });
        await invoke({ id: 't1', archived: true }, { id: 't1', archived: true });

        expect(mockSessions.autoSaveAndStop).not.toHaveBeenCalled();
    });

    it('should log a failure rather than throw', async () => {
        mockSessions.autoSaveAndStop.mockRejectedValue(new Error('disk full'));

        await invoke({ id: 't1', archived: false }, { id: 't1', archived: true });

        expect(log).toHaveBeenCalledWith(
            expect.objectContaining({ level: 'error' })
        );
    });
});
