import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '../../../events/commands/channel.js';
import { sharedData } from '../../../sharedData.js';

// Mock dependencies
vi.mock('../../../sharedData.js', () => ({
    sharedData: {
        channel: null,
    },
}));

vi.mock('discord.js', () => {
    return {
        SlashCommandBuilder: vi.fn(),
        ChannelType: {
            GuildText: 0,
        },
        MessageFlags: {
            Ephemeral: 64,
        },
    };
});

describe('channel command', () => {
    let mockInteraction;

    beforeEach(() => {
        // Reset the channel to null before each test
        sharedData.channel = null;

        // Create a mock interaction with necessary methods and properties
        mockInteraction = {
            options: {
                getChannel: vi.fn(),
            },
            channel: {
                id: 'current-channel-id',
                name: 'current-channel',
            },
            reply: vi.fn(),
        };
    });

    it('should set the channel to the provided channel', () => {
        // Mock the getChannel method to return a specific channel
        const mockChannel = {
            id: 'specified-channel-id',
            name: 'specified-channel',
        };
        mockInteraction.options.getChannel.mockReturnValue(mockChannel);

        // Call the invoke function
        invoke(mockInteraction);

        // Verify that sharedData.channel is set to the specified channel
        expect(sharedData.channel).toBe(mockChannel);

        // Verify that the interaction reply was called with the correct message
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: 'Game channel set to <#specified-channel-id>.',
            flags: 64, // MessageFlags.Ephemeral
        });
    });

    it('should default to the current channel if no channel is provided', () => {
        // Mock the getChannel method to return null
        mockInteraction.options.getChannel.mockReturnValue(null);

        // Call the invoke function
        invoke(mockInteraction);

        // Verify that sharedData.channel is set to the current channel
        expect(sharedData.channel).toBe(mockInteraction.channel);

        // Verify that the interaction reply was called with the correct message
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: 'Game channel set to <#current-channel-id>.',
            flags: 64, // MessageFlags.Ephemeral
        });
    });
});
