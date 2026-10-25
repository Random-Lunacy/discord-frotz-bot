import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// sharedData reads games.json from GAME_FOLDER when it is first loaded.
describe('sharedData', () => {
    let folder;
    const originalFolder = process.env.GAME_FOLDER;

    beforeEach(() => {
        vi.resetModules();
        folder = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-data-'));
    });

    afterEach(() => {
        process.env.GAME_FOLDER = originalFolder;
        fs.rmSync(folder, { recursive: true, force: true });
    });

    it('should load the list of games and remember the game folder', async () => {
        const games = [{ id: 'zork1', name: 'Zork I', file: 'zork-i.z3' }];
        fs.writeFileSync(path.join(folder, 'games.json'), JSON.stringify({ games }));
        process.env.GAME_FOLDER = folder;

        const { sharedData } = await import('../sharedData.js');

        expect(sharedData.gameList).toEqual({ games });
        expect(sharedData.gameFolder).toBe(folder);
        expect(sharedData.client).toBeNull();
    });

    it('should fail clearly when there is no games.json', async () => {
        process.env.GAME_FOLDER = folder;

        await expect(import('../sharedData.js')).rejects.toThrow(/games\.json/);
    });
});
