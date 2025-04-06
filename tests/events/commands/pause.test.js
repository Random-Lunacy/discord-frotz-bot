import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve paths before any imports or mocks
const pauseCommandPath = path.resolve(
    __dirname,
    '../../../events/commands/pause.js'
);
const sharedDataPath = '../../../sharedData.js';

// Mocking sharedData first
const mockSharedData = {
    gameActive: true,
    listenToGame: true,
    gameId: 'test-game',
    gameList: {
        games: [{ id: 'test-game', name: 'Test Game' }],
    },
};

// Mock dependencies with proper exports
vi.mock('discord.js', () => {
    return {
        SlashCommandBuilder: vi.fn(),
        MessageFlags: {
            Ephemeral: 64,
        },
        ButtonBuilder: vi.fn().mockImplementation(() => ({
            setCustomId: vi.fn().mockReturnThis(),
            setLabel: vi.fn().mockReturnThis(),
            setStyle: vi.fn().mockReturnThis(),
        })),
        ButtonStyle: {
            Danger: 4,
            Secondary: 2,
        },
        ActionRowBuilder: vi.fn().mockImplementation(() => ({
            addComponents: vi.fn().mockReturnThis(),
        })),
    };
});

// Use a relative path for the mock
vi.mock(sharedDataPath, () => ({
    sharedData: mockSharedData,
}));

// Now import the modules after mocking
const { invoke } = await import(pauseCommandPath);
const { sharedData } = await import(sharedDataPath);

describe('pause command', () => {
    let mockInteraction;
    let mockConfirmation;
    let mockResponse;

    beforeEach(() => {
        // Clear all mocks
        vi.clearAllMocks();

        // Reset the listenToGame state before each test
        mockSharedData.gameActive = true;
        mockSharedData.listenToGame = true;

        // Set up mock response for the initial interaction reply
        mockResponse = {
            awaitMessageComponent: vi.fn(),
        };

        // Set up mock interaction
        mockInteraction = {
            reply: vi.fn().mockResolvedValue(mockResponse),
            editReply: vi.fn().mockResolvedValue({}),
            user: { id: 'test-user-id' },
        };

        // Set up mock confirmation (for button clicks)
        mockConfirmation = {
            customId: '',
            update: vi.fn().mockResolvedValue({}),
        };
    });

    it('should show an error if no game is running', async () => {
        // Set gameActive to false to simulate no running game
        mockSharedData.gameActive = false;

        await invoke(mockInteraction);

        // Verify the interaction reply was called with the "no game running" message
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: 'No game is currently running.',
            flags: 64, // MessageFlags.Ephemeral
        });
    });

    it('should pause the game when confirm button is clicked', async () => {
        // Mock the awaitMessageComponent to simulate a user clicking the confirm button
        mockConfirmation.customId = 'confirm';
        mockResponse.awaitMessageComponent.mockResolvedValue(mockConfirmation);

        await invoke(mockInteraction);

        // Verify the interaction reply was called with the confirmation prompt
        expect(mockInteraction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining(
                    'Are you sure you want to pause the game?'
                ),
                components: expect.any(Array),
            })
        );

        // Verify that listenToGame was toggled to false (paused)
        expect(mockSharedData.listenToGame).toBe(false);

        // Verify that the confirmation was updated with the proper message
        expect(mockConfirmation.update).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Game paused'),
                components: [],
            })
        );
    });

    it('should unpause the game when already paused', async () => {
        // Set up the initial state to be paused
        mockSharedData.listenToGame = false;

        // Mock the awaitMessageComponent to simulate a user clicking the confirm button
        mockConfirmation.customId = 'confirm';
        mockResponse.awaitMessageComponent.mockResolvedValue(mockConfirmation);

        await invoke(mockInteraction);

        // Verify the interaction reply was called with the unpause confirmation prompt
        expect(mockInteraction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining(
                    'Are you sure you want to unpause the game?'
                ),
                components: expect.any(Array),
            })
        );

        // Verify that listenToGame was toggled to true (unpaused)
        expect(mockSharedData.listenToGame).toBe(true);

        // Verify that the confirmation was updated with the proper message
        expect(mockConfirmation.update).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Game unpaused'),
                components: [],
            })
        );
    });

    it('should do nothing when cancel button is clicked', async () => {
        // Record the initial state
        const initialListenState = mockSharedData.listenToGame;

        // Mock the awaitMessageComponent to simulate a user clicking the cancel button
        mockConfirmation.customId = 'cancel';
        mockResponse.awaitMessageComponent.mockResolvedValue(mockConfirmation);

        await invoke(mockInteraction);

        // Verify the interaction reply was called
        expect(mockInteraction.reply).toHaveBeenCalled();

        // Verify that listenToGame was not changed
        expect(mockSharedData.listenToGame).toBe(initialListenState);

        // Verify that the confirmation was updated with the cancellation message
        expect(mockConfirmation.update).toHaveBeenCalledWith(
            expect.objectContaining({
                content: 'Pause state toggle cancelled.',
                components: [],
            })
        );
    });

    it('should handle timeout if no button is clicked', async () => {
        // Mock the awaitMessageComponent to simulate a timeout
        mockResponse.awaitMessageComponent.mockRejectedValue(
            new Error('Timeout')
        );

        await invoke(mockInteraction);

        // Verify the interaction reply was called
        expect(mockInteraction.reply).toHaveBeenCalled();

        // Verify that editReply was called with the timeout message
        expect(mockInteraction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining(
                    'Confirmation not received within 1 minute'
                ),
                components: [],
            })
        );
    });
});
