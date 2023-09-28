import { SlashCommandBuilder } from 'discord.js';

// Import the shared data object
import { sharedData } from '../../sharedData.js';

// Creates an Object in JSON with the data required by Discord's API to create a SlashCommand
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause or unpause the game (toggles whether the bot will listen to messages).');

    return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = (interaction) => {
    if (sharedData.gameActive) {
        sharedData.playingGame = !sharedData.playingGame;
        interaction.reply({
            content: sharedData.playingGame ? 'Game unpaused.' : 'Game paused.',
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
