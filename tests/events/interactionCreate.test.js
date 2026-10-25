import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDenial = vi.fn();
const mockStart = { invoke: vi.fn() };

vi.mock('../../sharedData.js', () => ({
    sharedData: { client: { on: vi.fn(), user: { id: 'bot' } } },
}));
vi.mock('../../sessions.js', () => ({ sessions: { get: vi.fn() } }));
vi.mock('../../keyPrompt.js', () => ({
    handleKeyButton: vi.fn(),
    isKeyButton: vi.fn().mockReturnValue(false),
}));
vi.mock('../../logger.js', () => ({ Logger: { log: vi.fn() } }));
vi.mock('../../channelAccess.js', () => ({ channelDenial: mockDenial }));
vi.mock('discord.js', () => ({ MessageFlags: { Ephemeral: 64 } }));
vi.mock('#commands/start', () => mockStart);

const { invoke } = await import('../../events/interactionCreate.js');

describe('interactionCreate', () => {
    let interaction;

    beforeEach(() => {
        vi.clearAllMocks();
        mockDenial.mockReturnValue(null);
        interaction = {
            commandName: 'start',
            isChatInputCommand: () => true,
            reply: vi.fn(),
        };
    });

    it('should run a command where it is allowed', async () => {
        await invoke(interaction);

        expect(mockStart.invoke).toHaveBeenCalledWith(interaction);
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('should refuse a command in the wrong channel with a private reply, and not run it', async () => {
        mockDenial.mockReturnValue('Games can only be played in <#1>.');

        await invoke(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Games can only be played in <#1>.',
            flags: 64,
        });
        expect(mockStart.invoke).not.toHaveBeenCalled();
    });
});
