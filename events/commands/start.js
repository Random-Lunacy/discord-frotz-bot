import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { sharedData } from '../../sharedData.js';
import { launchGame } from '../../launchGame.js';

/**
 * Creates a new Slash Command for starting a game.
 *
 * @return {Object} The JSON representation of the created command.
 */

const create = () => {
    const command = new SlashCommandBuilder()
        .setName('start')
        .setDescription('Start a game in your own thread for it (made if needed), or in this thread.');

    command.addStringOption((option) =>
        option
            .setName('game')
            .setDescription('Game to start.')
            .setRequired(true)
    );

    let x, current;
    for (x = 0; x < sharedData.gameList.games.length; x++) {
        current = sharedData.gameList.games[x];
        command.options[0].addChoices(
            JSON.parse(`{"name": "${current.name}", "value": "${current.id}"}`)
        );
    }

    return command.toJSON();
};

/**
 * Invokes the specified interaction.
 *
 * @param {object} interaction - The interaction object to be invoked.
 */
const invoke = async (interaction) => {
    const game = interaction.options.getString('game');
    const gameObj = sharedData.gameList.games.find((it) => it.id === game);

    if (!gameObj) {
        await interaction.reply({
            content: `Could not find a game with ID "${game}".`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Play in the player's existing thread for this game, if they have one, rather than making another
    const result = await launchGame(interaction, gameObj, { reuse: true });
    if (result.error) {
        await interaction.editReply({ content: result.error });
        return;
    }

    await interaction.editReply({
        content: `Starting ${gameObj.name} in <#${result.session.channel.id}>.`,
    });
};

export { create, invoke };
