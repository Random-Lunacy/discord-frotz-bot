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

// Send command to dfrotz when a message is received if the game is active
sharedData.client.on('messageCreate', (message) => {
    // Only process messages if we are actively playing and the message is sent in the game channel
    if (sharedData.gameActive && sharedData.listenToGame && message.channel.id === sharedData.thread.id) {

        // Do nothing if the message is sent by the bot
        if (message.author.id == sharedData.client.user.id) {
            return;
        }

        // disable save in favor of the slash command
        if (message.content.match(/^(save)/i)) {
            sharedData.thread.send('Use `/save` to save the game.');
            return;
        }

        // disable restore in favor of the slash command
        if (message.content.match(/^(restore)/i)) {
            sharedData.thread.send('Use `/restore` to restore a saved game.');
            return;
        }

        // disable quit in favor of the slash command
        if (message.content.match(/^(quit)/i) || message.content.match(/^(q)/i)) {
            sharedData.thread.send('Use `/quit` to exit the game.');
            return;
        }

        // Send message to dfrotz
        sharedData.frotzClient.processInput(message.content);
    }
});

export { once, name, invoke };
