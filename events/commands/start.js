import { SlashCommandBuilder, ThreadAutoArchiveDuration, ChannelType } from 'discord.js';
import { sharedData } from '../../sharedData.js';

/**
 * Creates a new Slash Command for starting a game.
 *
 * @return {Object} The JSON representation of the created command.
 */

const create = () => {
    const command = new SlashCommandBuilder()
        .setName('start')
        .setDescription('Start a game. A new thread will be created in the current channel to host the game.');

    command.addStringOption((option) =>
        option.setName('game')
            .setDescription('Game to start.')
            .setRequired(true));

    let x, current;
    for (x = 0; x < sharedData.gameList.games.length; x++) {
        current = sharedData.gameList.games[x];
        command.options[0].addChoices(JSON.parse(`{"name": "${current.name}", "value": "${current.id}"}`));
    }

    return command.toJSON();
};


/**
 * Invokes the specified interaction.
 *
 * @param {object} interaction - The interaction object to be invoked.
 */
const invoke = async (interaction) => {
    const game = interaction.options.getString('game') ?? 'No game provided';

    if (sharedData.gameActive) {
        interaction.reply({
            content: 'A game is already running. You must stop the current game before starting a new one.',
            ephemeral: true,
        });
        return;
    }

    let gameObj = sharedData.gameList.games.filter(it => it.id === game)[0];

    if (interaction.channel.type === ChannelType.GuildText) {
        // Start the game in a new thread in the current channel
        sharedData.channel = interaction.channel;
        sharedData.thread = await interaction.channel.threads.create({
            name: gameObj.name,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneHour
        });
    } else {
        interaction.reply({
            content: 'Unable to start game in this channel.',
            ephemeral: true,
        });
        return;
    }

    // Add the user who started the game to the thread
    await sharedData.thread.members.add(interaction.user.id);

    interaction.reply({
        content: 'Starting ' + gameObj.name + ' in the <#' + sharedData.thread.id + '> thread. Please join the thread to play.',
        ephemeral: true,
    });

    if (!sharedData.frotzClient.startGame(gameObj.file)) {
        interaction.reply({
            content: sharedData.frotzClient.lastError.message,
            ephemeral: true,
        });
        return;
    }

    sharedData.gameId = game;
    sharedData.gameActive = true;
    sharedData.listenToGame = true;
};

export { create, invoke };
