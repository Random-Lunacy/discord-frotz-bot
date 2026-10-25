import { sharedData } from '../sharedData.js';
import { sessions } from '../sessions.js';
import { handleKeyButton, isKeyButton } from '../keyPrompt.js';
import { Logger } from '../logger.js';
import { channelDenial } from '../channelAccess.js';
import { MessageFlags } from 'discord.js';


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
    if (interaction.isChatInputCommand()) {
        // Commands only work in the channels the bot is allowed in (if any are set), and the reply
        // is private so that a command in the wrong channel leaves nothing behind
        const denial = channelDenial(interaction);
        if (denial) {
            await interaction.reply({ content: denial, flags: MessageFlags.Ephemeral });
            return;
        }
        (await import(`#commands/${interaction.commandName}`)).invoke(interaction);
    }
    else if (isKeyButton(interaction))
        await handleKeyButton(interaction);
}

// Send messages to the game in the channel or thread they were sent in, if there is one
sharedData.client.on('messageCreate', (message) => {
    // Do nothing if the message is sent by the bot
    if (message.author.id == sharedData.client.user.id) {
        return;
    }

    const session = sessions.get(message.channel.id);

    // Only process messages if a game is running here and it isn't paused
    if (!session || session.paused) {
        return;
    }

    session.touch();
    session.client.handleMessage(message);
});

export { once, name, invoke };
