import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { sharedData } from '../../sharedData.js';

/**
 * Creates a new Slash Command for quitting the game.
 *
 * @return {Object} The JSON representation of the created command.
 */
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('quit')
        .setDescription('Quits the game. All progress since the game was last saved will be lost.');

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

    let gameName = sharedData.gameList.games.filter(it => it.id === sharedData.gameId)[0].name;

    const confirm = new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel('Quit Game')
        .setStyle(ButtonStyle.Danger);

    const cancel = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder()
        .addComponents(cancel, confirm);

    const response = await interaction.reply({
        content: 'Are you sure you want quit ' + gameName + '? All progress since last save will be lost.',
        components: [row],
    });

    const collectorFilter = i => i.user.id === interaction.user.id;
    try {
        const confirmation = await response.awaitMessageComponent({ filter: collectorFilter, time: 60_000 });

        if (confirmation.customId === 'confirm') {
            sharedData.playingGame = false;
            sharedData.gameActive = false;
            sharedData.gameId = null;
            sharedData.frotzClient.stopGame();

            let gameObj = sharedData.gameList.games.filter(it => it.id === sharedData.gameId)[0];

            await confirmation.update({ content: 'Quitting ' + gameName + '.', components: [] });
        } else if (confirmation.customId === 'cancel') {
            await confirmation.update({ content: 'Quit cancelled.', components: [] });
        }
    } catch (e) {
        await interaction.editReply({ content: 'Confirmation not received within 1 minute, cancelling quit.', components: [] });
    }
}

export { create, invoke };
