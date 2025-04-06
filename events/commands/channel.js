import { SlashCommandBuilder, ChannelType, MessageFlags } from 'discord.js';

// Import the shared data object
import { sharedData } from '../../sharedData.js';

/**
 * Creates a new SlashCommandBuilder object to set the channel.
 *
 * @return {Object} The JSON representation of the command.
 */
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('channel')
        .setDescription('Set the  channel where the game will be played.')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription(
                    'Channel you want to use for playing the game (defaults to current channel).'
                )
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText)
        );

    return command.toJSON();
};

/**
 * Invokes the function with the given interaction.
 */
const invoke = (interaction) => {
    const channel = interaction.options.getChannel('channel');
    if (channel != null) {
        sharedData.channel = channel;
    } else {
        sharedData.channel = interaction.channel;
    }

    interaction.reply({
        content: 'Game channel set to <#' + sharedData.channel.id + '>.',
        flags: MessageFlags.Ephemeral,
    });
};

export { create, invoke };
