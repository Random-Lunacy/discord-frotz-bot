import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Runs real games through the shutdown path: they must be saved, announced and restorable.
const gameFolder = path.resolve('games');
const state = vi.hoisted(() => ({ gameFolder: '' }));

vi.mock('../sharedData.js', () => ({
    sharedData: {
        get gameFolder() {
            return state.gameFolder;
        },
    },
}));

const { GameSessions } = await import('../sessions.js');
const { ZMachineClient } = await import('../zmachineClient.js');

const hasZork = fs.existsSync(`${gameFolder}/zork-i.z3`);
const tick = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

describe.skipIf(!hasZork)('shutting down with games running', () => {
    const game = { id: 'zork1', name: 'Zork I', file: 'zork-i.z3' };
    let sessions;
    let sent;

    const makeChannel = (id) => ({
        id,
        name: id,
        send: vi.fn(async (message) => {
            sent[id].push(typeof message === 'string' ? message : message.content);
            return { delete: vi.fn() };
        }),
    });

    beforeEach(() => {
        state.gameFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'shutdown-'));
        fs.copyFileSync(`${gameFolder}/zork-i.z3`, `${state.gameFolder}/zork-i.z3`);
        sent = { 'thread-a': [], 'thread-b': [] };
        sessions = new GameSessions();
    });

    afterEach(() => {
        sessions.autoSaveAll().catch(() => {});
        fs.rmSync(state.gameFolder, { recursive: true, force: true });
    });

    it('should save every running game at the point it had reached, so it can be restored', async () => {
        const a = sessions.create({ channel: makeChannel('thread-a'), game, ownerId: 'u1' });
        const b = sessions.create({ channel: makeChannel('thread-b'), game, ownerId: 'u2' });
        for (const session of [a, b]) {
            session.client.startGame('zork-i.z3');
        }
        await tick(300);

        // Game A has moved to the north side of the house; game B has not moved
        a.client.processInput('north', 'u1');
        await tick();

        const results = await sessions.autoSaveAll();

        expect(sessions.size).toBe(0);
        expect(results.map((result) => result.savePath)).toEqual([
            expect.stringMatching(/zork1-thread-a-u1-\d+-autosave\.qzl$/),
            expect.stringMatching(/zork1-thread-b-u2-\d+-autosave\.qzl$/),
        ]);

        // Start a new bot's worth of games and restore game A from its save
        const fresh = new ZMachineClient({
            channel: makeChannel('thread-a'),
            gameId: 'zork1',
            gameName: 'Zork I',
        });
        try {
            fresh.startGame('zork-i.z3');
            await tick(300);
            sent['thread-a'].length = 0;

            expect(await fresh.restoreGame(results[0].savePath)).toBe(true);
            await tick(300);
            fresh.processInput('look');
            await tick();

            expect(sent['thread-a'].join('\n')).toContain('North of House');
        } finally {
            fresh.stopGame();
        }
    });
});
