import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { sharedData } from '../../sharedData.js';

/**
 * Creates a new Slash Command for starting a game.
 *
 * @return {Object} The JSON representation of the created command.
 */

const create = () => {
    const command = new SlashCommandBuilder()
        .setName('start')
        .setDescription(
            'Start a game. If not set with `/channel` the game will run in the current channel.'
        );

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
const invoke = (interaction) => {
    const game = interaction.options.getString('game') ?? 'No game provided';

    if (sharedData.gameActive) {
        interaction.reply({
            content:
                'A game is already running. You must stop the current game before starting a new one.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (sharedData.channel === null) {
        // Start the game in the current channel
        sharedData.channel = interaction.channel;
    }

    let gameObj = sharedData.gameList.games.filter((it) => it.id === game)[0];

    interaction.reply({
        content:
            'Starting ' +
            gameObj.name +
            ' in <#' +
            sharedData.channel.id +
            '>.',
        flags: MessageFlags.Ephemeral,
    });

    if (!sharedData.frotzClient.startGame(gameObj.file)) {
        interaction.reply({
            content: sharedData.frotzClient.lastError.message,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    sharedData.gameId = game;
    sharedData.gameActive = true;
    sharedData.listenToGame = true;
};

export { create, invoke };
