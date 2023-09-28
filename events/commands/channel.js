import { SlashCommandBuilder, ChannelType } from 'discord.js';

// Import the shared data object
import { sharedData } from '../../sharedData.js';

// Creates an Object in JSON with the data required by Discord's API to create a SlashCommand
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('channel')
        .setDescription('Set the  channel where the game will be played.')
        .addChannelOption((option) =>
            option.setName('channel')
                .setDescription('Channel you want to use for playing the game (defaults to current channel).')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText));

    return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = (interaction) => {
    const channel = interaction.options.getChannel('channel');
    if (channel != null) {
        sharedData.channel = channel;
    } else {
        sharedData.channel = interaction.channel;
    }

    interaction.reply({
        content: 'Game channel set to <#' + sharedData.channel.id + '>.',
        ephemeral: true,
    });
};

export { create, invoke };

