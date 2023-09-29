import { SlashCommandBuilder } from 'discord.js';
import { sharedData } from '../../sharedData.js';

// Creates an Object in JSON with the data required by Discord's API to create a SlashCommand
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('start')
        .setDescription('Start a game. If not set with `/channel` the game will run in the current channel.');

    command.addStringOption((option) =>
        option.setName('game')
            .setDescription('Game to start.')
            .setRequired(true));

    let x, current;
    for (x = 0; x < sharedData.gameList.games.length; x++) {
        current = sharedData.gameList.games[x];
        command.options[0].addChoices(JSON.parse(`{"name": "${current.name}", "value": "${current.id}"}`));
    }

    return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = (interaction) => {
    const game = interaction.options.getString('game') ?? 'No game provided';

    if (sharedData.gameActive) {
        interaction.reply({
            content: 'A game is already running. You must stop the current game before starting a new one.',
            ephemeral: true,
        });
        return;
    }

    if (sharedData.channel === null) {
        // Start the game in the current channel
        sharedData.channel = interaction.channel;
    }

    let gameObj = sharedData.gameList.games.filter(it => it.id === game)[0];

    interaction.reply({
        content: 'Starting ' + gameObj.name + ' in <#' + sharedData.channel.id + '>.',
        ephemeral: true,
    });

    if (!sharedData.frotzClient.startGame(gameObj.file)) {
        interaction.reply({
            content: sharedData.frotzClient.lastError.message,
            ephemeral: true,
        });
        return;
    }

    sharedData.gameId = game;
    sharedData.gameActive = true;
    sharedData.playingGame = true;
};

export { create, invoke };
