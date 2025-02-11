import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Import the shared data object
import { sharedData } from '../../sharedData.js';

// Creates an Object in JSON with the data required by Discord's API to create a SlashCommand
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('status')
        .setDescription('Show bot status.');

    return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = (interaction) => {
    let embed = new EmbedBuilder()
        .setTitle('Frotz Bot Status')
        .setColor(0x0099ff);

    let names = '', values = '';

    names += 'Game ID\n';
    names += 'Channel\n';
    names += 'Listening to Game\n';
    names += 'Game Active\n';

    values += sharedData.gameId == null ? 'No game selected\n' : sharedData.gameId + '\n';
    values += sharedData.thread == null ? 'No channel selected\n' : sharedData.thread.name + '\n';
    values += sharedData.listenToGame + '\n';
    values += sharedData.gameActive + '\n';

    embed.addFields([
        {
            name: 'Name',
            value: names,
            inline: true
        },
        {
            name: 'Value',
            value: values,
            inline: true
        },
    ]);

    interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
};

export { create, invoke };
