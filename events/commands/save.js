import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { sharedData } from '../../sharedData.js';
import { Logger } from '../../logger.js';

/**
 * Create a new slash command builder for saving the current game.
 *
 * @return {Object} The JSON representation of the slash command.
 */
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('save')
        .setDescription('Save the current game.');

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
            ephemeral: true,
        });
        return;
    }

    const confirm = new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel('Save Game')
        .setStyle(ButtonStyle.Success);

    const cancel = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder()
        .addComponents(cancel, confirm);

    const response = await interaction.reply({
        content: 'Are you sure you want save the game?',
        components: [row],
    });


    const collectorFilter = i => i.user.id === interaction.user.id;
    try {
        const confirmation = await response.awaitMessageComponent({ filter: collectorFilter, time: 60_000 });

        if (confirmation.customId === 'confirm') {
            Logger.log(interaction.user.id);
            Logger.log(interaction.user.username);
            Logger.log(interaction.user.globalName);
            let unixTime = Math.floor(Date.now() / 1000);
            let saveFile = `${sharedData.gameId}-${unixTime}-${interaction.user.id}.qzl`;
            let savePath = `${sharedData.gameFolder}/${saveFile}`;

            sharedData.frotzClient.saveGame(savePath);

            await confirmation.update({ content: 'Game Saved.', components: [] });
        } else if (confirmation.customId === 'cancel') {
            await confirmation.update({ content: 'Save cancelled.', components: [] });
        }
    } catch (e) {
        await interaction.editReply({ content: 'Confirmation not received within 1 minute, cancelling save.', components: [] });
    }
}

export { create, invoke };
