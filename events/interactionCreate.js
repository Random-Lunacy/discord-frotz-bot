import { sharedData } from '../sharedData.js';
import { Logger } from '../logger.js';


const once = false;
const name = 'interactionCreate';

async function invoke(interaction) {
    // Check if the interaction is a command and call the invoke method in the corresponding file
    // The #commands ES6 import-abbreviation is defined in the package.json
    if (interaction.isChatInputCommand())
        (await import(`#commands/${interaction.commandName}`)).invoke(interaction);
}

export { once, name, invoke };
sharedData.client.on('messageCreate', (message) => {
    // Only process messages if we are actively playing and the message is sent in the game channel
    if (sharedData.gameActive && sharedData.playingGame && message.channel.id === sharedData.channel.id) {

        // Do nothing if the message is sent by the bot
        if (message.author.id == sharedData.client.user.id) {
            return;
        }

        // disable save and restore
        if (message.content.match(/^(save)/i) || message.content.match(/^(restore)/i)) {
            sharedData.channel.send('Saving and restoring is not supported.');
            return;
        }

        // disable quit
        if (message.content.match(/^(quit)/i) || message.content.match(/^(q)/i)) {
            sharedData.channel.send('Use `/stop` to exit the game.');
            return;
        }

        // Send message to dfrotz
        sharedData.frotzClient.processInput(message.content);
    }
});
