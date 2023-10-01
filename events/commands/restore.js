import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder, ComponentType } from 'discord.js';
import { sharedData } from '../../sharedData.js';
import { glob } from 'glob';
import dateFormat from 'dateformat';

import { Logger } from '../../logger.js';

/**
 * Create a new slash command builder for restoring a saved game.
 *
 * @return {Object} The JSON representation of the slash command.
 */
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('restore')
        .setDescription('Restore a saved game.');

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
            content: 'No game is currently running, please start the game you want to restore a save for first.',
            ephemeral: true,
        });
        return;
    }

    const displayName = sharedData.gameList.games.filter(it => it.id === sharedData.gameId)[0].name;

    const qzlFiles = await glob(sharedData.gameFolder + '/' + sharedData.gameId + '-*.qzl', { nodir: true });
    if (qzlFiles.length === 0) {
        interaction.reply({
            content: 'No saved games found for ' + displayName + '.',
            ephemeral: true,
        });
        return;
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId('starter')
        .setPlaceholder('Make a selection!');

    qzlFiles.forEach(file => {
        let fileFields = file.substring(0, file.length - 4).split('-');
        let saveTime = new Date(parseInt(fileFields[1] * 1000));
        select.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(sharedData.client.users.cache.get(fileFields[2]).globalName + ': ' + dateFormat(saveTime, 'default'))
                .setDescription('Created on ' + dateFormat(saveTime, 'dddd, mmmm dS, yyyy, h:MM:ss TT'))
                .setValue(file)
        );
    });

    select.addOptions(
        new StringSelectMenuOptionBuilder()
            .setLabel('Cancel')
            .setDescription('Cancel the restore')
            .setValue('cancel')
    );

    const row = new ActionRowBuilder()
        .addComponents(select);

    const response = await interaction.reply({
        content: 'Choose the save you want to restore.',
        components: [row],
    });

    const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60_000 });

    collector.on('collect', async i => {
        const selection = i.values[0];
        if (selection === 'cancel') {
            await interaction.editReply({ content: 'Restore cancelled.', components: [] });
            return;
        }

        let savePath = `${sharedData.gameFolder}/${selection}`;
        let restoredFileFields = selection.substring(0, selection.length - 4).split('-');
        let restoredTime = new Date(parseInt(restoredFileFields[1] * 1000));
        sharedData.frotzClient.restoreGame(savePath);

        await interaction.editReply({
            content: displayName + ' restored with save from ' + dateFormat(restoredTime, 'default') + '.',
            components: []
        });
    });
}

export { create, invoke };
