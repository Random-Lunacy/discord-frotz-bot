import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '../../../events/commands/games.js';

vi.mock('../../../sharedData.js', () => ({
    sharedData: {
        gameList: {
            games: [
                { id: 'game1', name: 'Zork I' },
                { id: 'game2', name: 'Adventure' },
            ],
        },
    },
}));

vi.mock('discord.js', () => {
    return {
        EmbedBuilder: vi.fn().mockImplementation(() => ({
            setTitle: vi.fn().mockReturnThis(),
            setDescription: vi.fn().mockReturnThis(),
            setColor: vi.fn().mockReturnThis(),
            addFields: vi.fn().mockReturnThis(),
        })),
        SlashCommandBuilder: vi.fn(),
    };
});

describe('games command', () => {
    let mockInteraction;

    beforeEach(() => {
        mockInteraction = {
            reply: vi.fn(),
        };
    });

    it('should list available games', () => {
        invoke(mockInteraction);

        expect(mockInteraction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                ephemeral: true,
            })
        );
    });
});
