import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    SlashCommandBuilder,
    MessageFlags,
} from 'discord.js';
import { sessions } from '../../sessions.js';
import { isAdmin } from '../../permissions.js';

/**
 * Creates a new Slash Command for force-quitting the game in this channel. Admins only.
 *
 * @return {Object} The JSON representation of the created command.
 */
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('quit')
        .setDescription(
            'Admins only: force the game in this channel or thread to stop. Progress since the last save is lost.'
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

    return command.toJSON();
};

/**
 * Asynchronously invokes the function with the given interaction.
 *
 * @param {Object} interaction - The interaction object.
 */
async function invoke(interaction) {
    if (!isAdmin(interaction)) {
        interaction.reply({
            content: 'Only server admins can force a game to quit. Type `quit` in the game to leave it yourself.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const session = sessions.get(interaction.channel.id);
    if (!session) {
        interaction.reply({
            content: 'No game is currently running here.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const gameName = session.game.name;

    const confirm = new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel('Quit Game')
        .setStyle(ButtonStyle.Danger);

    const cancel = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(cancel, confirm);

    const response = await interaction.reply({
        content:
            'Are you sure you want quit ' +
            gameName +
            '? All progress since last save will be lost.',
        components: [row],
    });

    const collectorFilter = (i) => i.user.id === interaction.user.id;
    try {
        const confirmation = await response.awaitMessageComponent({
            filter: collectorFilter,
            time: 60_000,
        });

        if (confirmation.customId === 'confirm') {
            sessions.stop(interaction.channel.id);

            await confirmation.update({
                content: 'Quitting ' + gameName + '.',
                components: [],
            });
        } else if (confirmation.customId === 'cancel') {
            await confirmation.update({
                content: 'Quit cancelled.',
                components: [],
            });
        }
    } catch (e) {
        await interaction.editReply({
            content:
                'Confirmation not received within 1 minute, cancelling quit.',
            components: [],
        });
    }
}

export { create, invoke };
