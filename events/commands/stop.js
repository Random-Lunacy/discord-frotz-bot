import { SlashCommandBuilder } from 'discord.js';

// Import the shared data object
import { sharedData } from '../../sharedData.js';

// Creates an Object in JSON with the data required by Discord's API to create a SlashCommand
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops the game. All progress will be lost.');

    return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = (interaction) => {
    if (sharedData.gameActive) {
        sharedData.playingGame = false;
        sharedData.gameActive = false;
        sharedData.gameId = null;
        sharedData.frotzClient.stopGame();
        interaction.reply({
            content: 'Game stopped.',
            ephemeral: true,
        });
    } else {
        interaction.reply({
            content: 'No game is currently running.',
            ephemeral: true,
        });
    }
};

export { create, invoke };
