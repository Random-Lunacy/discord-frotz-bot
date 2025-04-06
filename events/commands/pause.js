import {
    SlashCommandBuilder,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
} from 'discord.js';

// Import the shared data object
import { sharedData } from '../../sharedData.js';

/**
 * Creates a new slash command for pausing or unpausing the game.
 *
 * @return {Object} The JSON representation of the slash command.
 */
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('pause')
        .setDescription(
            'Pause or unpause the game (toggles whether the bot will listen to messages).'
        );

    return command.toJSON();
};

/**
 * Asynchronously invokes the function with the given interaction.
 *
 * @param {Object} interaction - The interaction object.
 */
async function invoke(interaction) {
    if (!sharedData.gameActive) {
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
    if (!sharedData.listenToGame) {
        confirmButtonText = 'Unpause Game';
        confirmMessage =
            'Are you sure you want to unpause the game? The game will resume listening to messages.';
        responseMessage = 'Game unpaused.';
    }

    let gameName = sharedData.gameList.games.filter(
        (it) => it.id === sharedData.gameId
    )[0].name;

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
            sharedData.listenToGame = !sharedData.listenToGame;

            await confirmation.update({
                content: responseMessage + gameName + '.',
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
