import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { gameConfig } from '../../gameConfig.js';

// Creates an Object in JSON with the data required by Discord's API to create a SlashCommand
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('games')
        .setDescription('Lists avialable games');

    return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = (interaction) => {
    var embed = new EmbedBuilder()
    .setTitle('Available Games')
    .setColor(0x0099ff);

    let x, current, names = '', commands = '';

    for (x = 0; x < gameConfig.games.length; x++) {
        current = gameConfig.games[x];
        names += current.name + '\n';
        commands += '`/startGame ' + current.id + '`\n';
    }

    embed.addFields([
        {
            name: 'Name',
            value: names,
            inline: true
        },
        {
            name: '\u200B',
            value: '\u200B',
            inline: true
        },
        {
            name: 'Command',
            value: commands,
            inline: true
        }

    ]);

    interaction.reply({
        embeds: [embed]
    });
};

export { create, invoke };
