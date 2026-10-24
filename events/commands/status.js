import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

import { sessions } from '../../sessions.js';
import { isAdmin } from '../../permissions.js';

// Discord limits an embed field to 1024 characters
const MAX_FIELD_LENGTH = 1024;

// Creates an Object in JSON with the data required by Discord's API to create a SlashCommand
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('status')
        .setDescription('Show the game in this channel. Admins can list every game in progress.')
        .addBooleanOption((option) =>
            option
                .setName('all')
                .setDescription('Admins only: show every game in progress.')
                .setRequired(false)
        );

    return command.toJSON();
};

/**
 * Describe how long ago something happened, e.g. "5m ago".
 *
 * @param {number} time - Milliseconds since the epoch.
 * @param {number} [now] - The current time.
 * @return {string} A short description.
 */
const ago = (time, now = Date.now()) => {
    const minutes = Math.floor((now - time) / 60_000);
    if (minutes < 1) {
        return 'just now';
    }
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    return hours < 48 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
};

const describe = (session) =>
    `<#${session.channel.id}> **${session.game.name}**, started by <@${session.ownerId}> ${ago(session.startedAt)}, ` +
    `last activity ${ago(session.lastActivity)}${session.paused ? ', paused' : ''}`;

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = (interaction) => {
    const embed = new EmbedBuilder().setTitle('Frotz Bot Status').setColor(0x0099ff);

    if (interaction.options.getBoolean('all')) {
        if (!isAdmin(interaction)) {
            interaction.reply({
                content: 'Only server admins can list every game.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const all = sessions.list();
        let lines = all.map(describe).join('\n');
        if (lines.length > MAX_FIELD_LENGTH) {
            lines = lines.slice(0, MAX_FIELD_LENGTH - 20).replace(/\n[^\n]*$/, '') + '\n…and more';
        }

        embed.addFields([
            {
                name: `Games in progress (${all.length} of ${sessions.maxGames})`,
                value: lines || 'No games are running.',
            },
        ]);
    } else {
        const session = sessions.get(interaction.channel.id);
        embed.addFields([
            {
                name: 'This channel',
                value: session ? describe(session) : 'No game is running here. Use `/start` to begin one.',
            },
            {
                name: 'Games in progress',
                value: `${sessions.size} of ${sessions.maxGames}`,
            },
        ]);
    }

    interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
    });
};

export { create, invoke };
