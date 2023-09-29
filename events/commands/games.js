import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { sharedData } from '../../sharedData.js';

// Creates an Object in JSON with the data required by Discord's API to create a SlashCommand
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('games')
        .setDescription('Lists available games');

    return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = (interaction) => {
    let embed = new EmbedBuilder()
        .setTitle('Available Games')
        .setDescription('Start a game with `/start [game]`. Only one game may be running at a time.')
        .setColor(0x0099ff);

    let x, current, names = '';

    for (x = 0; x < sharedData.gameList.games.length; x++) {
        current = sharedData.gameList.games[x];
        names += current.name + '\n';
    }

    embed.addFields([
        {
            name: 'Name',
            value: names,
            inline: true
        },
    ]);

    interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
};

export { create, invoke };
