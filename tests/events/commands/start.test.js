import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLaunchGame = vi.fn();

vi.mock('../../../launchGame.js', () => ({ launchGame: mockLaunchGame }));
vi.mock('../../../sharedData.js', () => ({
    sharedData: {
        gameList: { games: [{ id: 'zork1', name: 'Zork I', file: 'zork-i.z3' }] },
    },
}));
vi.mock('discord.js', () => ({
    SlashCommandBuilder: vi.fn(),
    MessageFlags: { Ephemeral: 64 },
}));

const { invoke } = await import('../../../events/commands/start.js');

describe('start command', () => {
    let interaction;

    beforeEach(() => {
        vi.clearAllMocks();
        interaction = {
            options: { getString: vi.fn().mockReturnValue('zork1') },
            reply: vi.fn(),
            deferReply: vi.fn(),
            editReply: vi.fn(),
        };
        mockLaunchGame.mockResolvedValue({
            session: { channel: { id: 'thread-1' } },
        });
    });

    it('should play in the player\'s existing thread for the game when there is one', async () => {
        await invoke(interaction);

        expect(mockLaunchGame).toHaveBeenCalledWith(
            interaction,
            expect.objectContaining({ id: 'zork1' }),
            { reuse: true }
        );
        expect(interaction.editReply).toHaveBeenCalledWith({
            content: 'Starting Zork I in <#thread-1>.',
        });
    });

    it('should tell the player why a game could not start', async () => {
        mockLaunchGame.mockResolvedValue({ error: 'No room.' });

        await invoke(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith({ content: 'No room.' });
    });

    it('should reject an unknown game', async () => {
        interaction.options.getString.mockReturnValue('nope');

        await invoke(interaction);

        expect(mockLaunchGame).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('"nope"') })
        );
    });
});
