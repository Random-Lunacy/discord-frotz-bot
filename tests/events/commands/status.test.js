import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '../../../events/commands/status.js';

// Mock dependencies
vi.mock('../../../sharedData.js', () => ({
    sharedData: {
        gameId: 'test-game',
        channel: { name: 'test-channel' },
        listenToGame: true,
        gameActive: true,
    },
}));

vi.mock('discord.js', () => {
    return {
        EmbedBuilder: vi.fn().mockImplementation(() => ({
            setTitle: vi.fn().mockReturnThis(),
            setColor: vi.fn().mockReturnThis(),
            addFields: vi.fn().mockReturnThis(),
        })),
        SlashCommandBuilder: vi.fn(),
    };
});

describe('status command', () => {
    let mockInteraction;

    beforeEach(() => {
        mockInteraction = {
            reply: vi.fn(),
        };
    });

    it('should reply with current bot status', () => {
        invoke(mockInteraction);

        expect(mockInteraction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                ephemeral: true,
            })
        );
    });
});
