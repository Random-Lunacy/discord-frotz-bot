import { MessageFlags } from 'discord.js';
import { sessions } from './sessions.js';
import { KEY_BUTTON_ID } from './zmachineClient.js';

/**
 * Whether a button click is the Continue button on a "press any key" prompt.
 *
 * @param {object} interaction - The interaction.
 * @return {boolean} True for the Continue button.
 */
export function isKeyButton(interaction) {
    return interaction.isButton?.() && interaction.customId === KEY_BUTTON_ID;
}

/**
 * Press a key for the game in this thread when someone clicks Continue.
 *
 * @param {object} interaction - The button interaction.
 */
export async function handleKeyButton(interaction) {
    const session = sessions.get(interaction.channel.id);

    if (session?.paused) {
        await interaction.reply({
            content: 'The game is paused. Use `/pause` to resume it.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (session?.client.pressKey(interaction.user.id)) {
        session.touch();
        // The client removes the button's message once the key is pressed
        await interaction.deferUpdate();
        return;
    }

    // The prompt was already answered (or the game has gone): take the stale button away
    await interaction.update({
        content: '-# That prompt has already been answered.',
        components: [],
    });
}
