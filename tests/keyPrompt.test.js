import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSessions = { get: vi.fn() };

vi.mock('../sessions.js', () => ({ sessions: mockSessions }));
vi.mock('discord.js', () => ({ MessageFlags: { Ephemeral: 64 } }));
vi.mock('../zmachineClient.js', () => ({ KEY_BUTTON_ID: 'anykey' }));

const { handleKeyButton, isKeyButton } = await import('../keyPrompt.js');

describe('isKeyButton', () => {
    it('should recognise the Continue button only', () => {
        expect(isKeyButton({ isButton: () => true, customId: 'anykey' })).toBe(true);
        expect(isKeyButton({ isButton: () => true, customId: 'confirm' })).toBe(false);
        expect(isKeyButton({ isButton: () => false, customId: 'anykey' })).toBe(false);
    });
});

describe('handleKeyButton', () => {
    let interaction;
    let session;

    beforeEach(() => {
        vi.clearAllMocks();
        session = {
            paused: false,
            touch: vi.fn(),
            client: { pressKey: vi.fn().mockReturnValue(true) },
        };
        mockSessions.get.mockReturnValue(session);
        interaction = {
            channel: { id: 't1' },
            user: { id: 'u1' },
            reply: vi.fn(),
            update: vi.fn(),
            deferUpdate: vi.fn(),
        };
    });

    it('should press a key for the player who clicked', async () => {
        await handleKeyButton(interaction);

        expect(mockSessions.get).toHaveBeenCalledWith('t1');
        expect(session.client.pressKey).toHaveBeenCalledWith('u1');
        expect(session.touch).toHaveBeenCalled();
        expect(interaction.deferUpdate).toHaveBeenCalled();
    });

    it('should take a stale button away when the prompt was already answered', async () => {
        session.client.pressKey.mockReturnValue(false);

        await handleKeyButton(interaction);

        expect(interaction.update).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('already been answered'),
                components: [],
            })
        );
        expect(interaction.deferUpdate).not.toHaveBeenCalled();
    });

    it('should take the button away when the game has gone', async () => {
        mockSessions.get.mockReturnValue(undefined);

        await handleKeyButton(interaction);

        expect(interaction.update).toHaveBeenCalledWith(
            expect.objectContaining({ components: [] })
        );
    });

    it('should not press a key in a paused game', async () => {
        session.paused = true;

        await handleKeyButton(interaction);

        expect(session.client.pressKey).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ flags: 64 })
        );
    });
});
