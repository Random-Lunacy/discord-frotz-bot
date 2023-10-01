import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { sharedData } from '../../sharedData.js';

/**
 * Creates a new slash command for listing available games.
 *
 * @return {Object} The JSON representation of the slash command.
 */
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('games')
        .setDescription('Lists available games');

    return command.toJSON();
};

/**
 * Generates a response to an interaction event.
 *
 * @param {object} interaction - The interaction event object.
 */
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
