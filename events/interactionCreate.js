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
    // Check if the message is sent in a specific channel
    if (sharedData.gameActive && sharedData.playingGame && message.channel.id === sharedData.channel.id) {
        Logger.log('Input: ' + message.content);
    }
});
