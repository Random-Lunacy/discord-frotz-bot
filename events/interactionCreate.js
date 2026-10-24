import { sharedData } from '../sharedData.js';
import { Logger } from '../logger.js';


const once = false;
const name = 'interactionCreate';

/**
 * Check if the interaction is a command and call the invoke method in the corresponding file.
 *
 * @param {object} interaction - The interaction object.
 * @return {Promise} A promise that resolves when the invoke method is called.
 */
async function invoke(interaction) {
    // Check if the interaction is a command and call the invoke method in the corresponding file
    // The #commands ES6 import-abbreviation is defined in the package.json
    if (interaction.isChatInputCommand())
        (await import(`#commands/${interaction.commandName}`)).invoke(interaction);
}

// Send messages to the game when a message is received if the game is active
sharedData.client.on('messageCreate', (message) => {
    // Only process messages if we are actively playing and the message is sent in the game channel
    if (sharedData.gameActive && sharedData.listenToGame && message.channel.id === sharedData.channel.id) {

        // Do nothing if the message is sent by the bot
        if (message.author.id == sharedData.client.user.id) {
            return;
        }

        sharedData.gameClient.handleMessage(message);
    }
});

export { once, name, invoke };
