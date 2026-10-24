import { PermissionFlagsBits } from 'discord.js';

/**
 * Whether the user who ran a command is a server admin (can manage the server).
 *
 * @param {object} interaction - The command interaction.
 * @return {boolean} True for admins.
 */
export function isAdmin(interaction) {
    return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}
