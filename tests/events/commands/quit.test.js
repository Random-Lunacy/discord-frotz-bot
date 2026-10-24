import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSessions = { get: vi.fn(), stop: vi.fn() };
const mockPermissions = { isAdmin: vi.fn() };

vi.mock('../../../sessions.js', () => ({ sessions: mockSessions }));
vi.mock('../../../permissions.js', () => mockPermissions);

vi.mock('discord.js', () => ({
    ButtonBuilder: vi.fn().mockImplementation(function () {
        return {
            setCustomId: vi.fn().mockReturnThis(),
            setLabel: vi.fn().mockReturnThis(),
            setStyle: vi.fn().mockReturnThis(),
        };
    }),
    ButtonStyle: { Danger: 4, Secondary: 2 },
    ActionRowBuilder: vi.fn().mockImplementation(function () {
        return { addComponents: vi.fn().mockReturnThis() };
    }),
    SlashCommandBuilder: vi.fn(),
    PermissionFlagsBits: { ManageGuild: 32n },
    MessageFlags: { Ephemeral: 64 },
}));

const { invoke } = await import('../../../events/commands/quit.js');

describe('quit command', () => {
    let interaction;
    let response;
    let confirmation;

    beforeEach(() => {
        vi.clearAllMocks();
        response = { awaitMessageComponent: vi.fn() };
        confirmation = { customId: 'confirm', update: vi.fn() };
        response.awaitMessageComponent.mockResolvedValue(confirmation);
        interaction = {
            channel: { id: 'thread-1' },
            user: { id: 'admin-1' },
            reply: vi.fn().mockResolvedValue(response),
            editReply: vi.fn(),
        };
        mockPermissions.isAdmin.mockReturnValue(true);
        mockSessions.get.mockReturnValue({ game: { name: 'Zork I' } });
    });

    it('should refuse anyone who is not an admin', async () => {
        mockPermissions.isAdmin.mockReturnValue(false);

        await invoke(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Only server admins'),
                flags: 64,
            })
        );
        expect(mockSessions.stop).not.toHaveBeenCalled();
    });

    it('should say when no game is running in the channel', async () => {
        mockSessions.get.mockReturnValue(undefined);

        await invoke(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: 'No game is currently running here.',
            })
        );
    });

    it('should stop the channel\'s game once an admin confirms', async () => {
        await invoke(interaction);

        expect(mockSessions.stop).toHaveBeenCalledWith('thread-1');
        expect(confirmation.update).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Quitting Zork I.' })
        );
    });

    it('should leave the game running when cancelled', async () => {
        confirmation.customId = 'cancel';

        await invoke(interaction);

        expect(mockSessions.stop).not.toHaveBeenCalled();
    });
});
