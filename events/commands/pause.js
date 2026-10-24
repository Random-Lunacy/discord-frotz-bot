import {
    SlashCommandBuilder,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
} from 'discord.js';

// Import the shared data object
import { sessions } from '../../sessions.js';

/**
 * Creates a new slash command for pausing or unpausing the game.
 *
 * @return {Object} The JSON representation of the slash command.
 */
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('pause')
        .setDescription(
            'Pause or unpause the game in this channel (toggles whether the bot will listen to messages).'
        );

    return command.toJSON();
};

/**
 * Asynchronously invokes the function with the given interaction.
 *
 * @param {Object} interaction - The interaction object.
 */
async function invoke(interaction) {
    const session = sessions.get(interaction.channel.id);
    if (!session) {
        interaction.reply({
            content: 'No game is currently running.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    let confirmButtonText = 'Pause Game';
    let confirmMessage =
        'Are you sure you want to pause the game? The game will stop listening to messages while paused.';
    let responseMessage = 'Game paused.';
    if (session.paused) {
        confirmButtonText = 'Unpause Game';
        confirmMessage =
            'Are you sure you want to unpause the game? The game will resume listening to messages.';
        responseMessage = 'Game unpaused.';
    }

    let gameName = session.game.name;

    const confirm = new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel(confirmButtonText)
        .setStyle(ButtonStyle.Danger);

    const cancel = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(cancel, confirm);

    const response = await interaction.reply({
        content: confirmMessage,
        components: [row],
    });

    const collectorFilter = (i) => i.user.id === interaction.user.id;
    try {
        const confirmation = await response.awaitMessageComponent({
            filter: collectorFilter,
            time: 60_000,
        });

        if (confirmation.customId === 'confirm') {
            session.paused = !session.paused;

            await confirmation.update({
                content: responseMessage + ' ' + gameName + '.',
                components: [],
            });
        } else if (confirmation.customId === 'cancel') {
            await confirmation.update({
                content: 'Pause state toggle cancelled.',
                components: [],
            });
        }
    } catch (e) {
        await interaction.editReply({
            content:
                'Confirmation not received within 1 minute, cancelling toggle of pause state.',
            components: [],
        });
    }
}

export { create, invoke };
