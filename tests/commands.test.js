import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';

// Build every command with the real discord.js builders, so a description or option that Discord
// would reject (for example a description over 100 characters) fails here, not when the bot starts.
vi.mock('../sharedData.js', () => ({
    sharedData: {
        gameFolder: '/games',
        gameList: {
            games: [{ id: 'zork1', name: 'Zork I', file: 'zork-i.z3' }],
        },
    },
}));

const files = fs
    .readdirSync('events/commands')
    .filter((file) => file.endsWith('.js'));

describe('slash commands', () => {
    it('should find the commands', () => {
        expect(files.length).toBeGreaterThan(0);
    });

    it.each(files)('%s should build a command Discord accepts', async (file) => {
        const command = await import(`../events/commands/${file}`);

        const json = command.create();

        expect(json.name).toBe(file.slice(0, -3));
        expect(json.description.length).toBeGreaterThan(0);
        expect(json.description.length).toBeLessThanOrEqual(100);
        for (const option of json.options ?? []) {
            expect(option.description.length).toBeLessThanOrEqual(100);
        }
    });
});
