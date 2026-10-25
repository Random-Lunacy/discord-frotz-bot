import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    buildSaveName,
    DEFAULT_LABEL_TEMPLATE,
    describeSave,
    describeSavePath,
    expandLabelTemplate,
    gameForChannel,
    listSaves,
    preferChannel,
    parseSaveName,
    sanitizeLabel,
} from '../saves.js';

describe('sanitizeLabel', () => {
    it('should lower case and join words with underscores', () => {
        expect(sanitizeLabel('Before The Troll')).toBe('before_the_troll');
    });

    it('should drop anything that is not a letter, number or underscore', () => {
        expect(sanitizeLabel('../../etc/passwd; -rm')).toBe('etcpasswd_rm');
    });

    it('should limit the length', () => {
        expect(sanitizeLabel('a'.repeat(100))).toHaveLength(32);
    });

    it('should return an empty string when nothing is usable', () => {
        expect(sanitizeLabel('!!! ---')).toBe('');
        expect(sanitizeLabel(undefined)).toBe('');
    });
});

describe('expandLabelTemplate', () => {
    const now = new Date(2026, 9, 24, 9, 5);

    it('should fill in the default template', () => {
        expect(
            expandLabelTemplate(DEFAULT_LABEL_TEMPLATE, { user: 'Mitch' }, now)
        ).toBe('mitch_20261024_0905');
    });

    it('should fill in game and channel', () => {
        expect(
            expandLabelTemplate(
                '{game} in {channel}',
                { game: 'zork1', channel: 'frotz-dev' },
                now
            )
        ).toBe('zork1_in_frotzdev');
    });

    it('should leave unknown and missing placeholders empty', () => {
        expect(expandLabelTemplate('{nope}x{user}', {}, now)).toBe('x');
    });

    it('should sanitize what the template produces', () => {
        expect(expandLabelTemplate('../{user}', { user: 'A B' }, now)).toBe(
            'a_b'
        );
    });
});

describe('buildSaveName', () => {
    const save = {
        gameId: 'zork1',
        channelId: '1158820946925338686',
        userId: '245714843821277185',
        time: 1792855087,
    };

    it('should include game, channel, user and time', () => {
        expect(buildSaveName(save)).toBe(
            'zork1-1158820946925338686-245714843821277185-1792855087.qzl'
        );
    });

    it('should append a sanitized label', () => {
        expect(buildSaveName({ ...save, label: 'Before the Troll!' })).toBe(
            'zork1-1158820946925338686-245714843821277185-1792855087-before_the_troll.qzl'
        );
    });
});

describe('parseSaveName', () => {
    it('should parse a name without a label', () => {
        expect(
            parseSaveName('zork1-1158820946925338686-245714843821277185-1792855087.qzl')
        ).toEqual({
            gameId: 'zork1',
            channelId: '1158820946925338686',
            userId: '245714843821277185',
            time: 1792855087,
            label: '',
        });
    });

    it('should parse a name with a label from a full path', () => {
        const parsed = parseSaveName(
            '/home/me/discord-frotz-bot/games/zork1-1-2-1792855087-before_the_troll.qzl'
        );

        expect(parsed.label).toBe('before_the_troll');
        expect(parsed.time).toBe(1792855087);
    });

    it('should parse the original <game>-<time>-<user> names', () => {
        expect(
            parseSaveName('sorcerer-1696122293-245714843821277185.qzl')
        ).toEqual({
            gameId: 'sorcerer',
            channelId: null,
            userId: '245714843821277185',
            time: 1696122293,
            label: '',
        });
    });

    it('should round trip what buildSaveName makes', () => {
        const save = {
            gameId: 'ztuu',
            channelId: '99',
            userId: '42',
            time: 1700000000,
            label: 'start',
        };

        expect(parseSaveName(buildSaveName(save))).toEqual(save);
    });

    it('should return null for anything that is not a save', () => {
        expect(parseSaveName('zork1.z3')).toBeNull();
        expect(parseSaveName('notes.qzl')).toBeNull();
        expect(parseSaveName('a-b-c-d-e-f-g.qzl')).toBeNull();
    });
});

describe('listSaves', () => {
    let folder;

    beforeEach(() => {
        folder = fs.mkdtempSync(path.join(os.tmpdir(), 'saves-'));
        for (const name of [
            'zork1-1-2-300.qzl',
            'zork1-1-2-500-latest_one.qzl',
            'zork1-400-2.qzl',
            'zork2-1-2-900.qzl',
            'zork1.z3',
        ]) {
            fs.writeFileSync(path.join(folder, name), '');
        }
    });

    afterEach(() => {
        fs.rmSync(folder, { recursive: true });
    });

    it('should list only the saves for the game, newest first', () => {
        const saves = listSaves(folder, 'zork1');

        expect(saves.map((save) => save.time)).toEqual([500, 400, 300]);
        expect(saves[0].path).toBe(`${folder}/zork1-1-2-500-latest_one.qzl`);
    });

    it('should return an empty list when the folder cannot be read', () => {
        expect(listSaves(`${folder}/missing`, 'zork1')).toEqual([]);
    });
});

describe('preferChannel', () => {
    const save = (channelId, time) => ({ channelId, time });

    it('should put saves from the channel first, each group newest first', () => {
        const saves = [save('b', 900), save('a', 800), save('b', 700), save('a', 600)];

        expect(preferChannel(saves, 'a')).toEqual([
            save('a', 800),
            save('a', 600),
            save('b', 900),
            save('b', 700),
        ]);
    });

    it('should leave the order alone when no save is from the channel', () => {
        const saves = [save('b', 900), save('c', 800)];

        expect(preferChannel(saves, 'a')).toEqual(saves);
    });
});

describe('gameForChannel', () => {
    const games = [
        { id: 'zork1', name: 'Zork' },
        { id: 'zork2', name: 'Zork II' },
        { id: 'sorcerer', name: 'Sorcerer' },
    ];
    let folder;

    beforeEach(() => {
        folder = fs.mkdtempSync(path.join(os.tmpdir(), 'saves-'));
    });

    afterEach(() => {
        fs.rmSync(folder, { recursive: true });
    });

    const addSave = (name) => fs.writeFileSync(path.join(folder, name), '');

    it('should use the game of the newest save made in the thread', () => {
        addSave('zork1-t1-u1-100.qzl');
        addSave('sorcerer-t1-u1-200.qzl');
        addSave('zork2-t2-u1-300.qzl');

        expect(gameForChannel(folder, games, { id: 't1', name: 'x' }).id).toBe('sorcerer');
    });

    it('should fall back to the game named in the thread\'s name', () => {
        expect(
            gameForChannel(folder, games, { id: 't9', name: 'Sorcerer - Mitch' }).id
        ).toBe('sorcerer');
    });

    it('should not mistake a longer game name for a shorter one', () => {
        expect(
            gameForChannel(folder, games, { id: 't9', name: 'Zork II - Mitch' }).id
        ).toBe('zork2');
    });

    it('should return null when the thread says nothing about a game', () => {
        expect(gameForChannel(folder, games, { id: 't9', name: 'general chat' })).toBeNull();
    });
});

describe('describeSave', () => {
    const save = { label: 'before_the_troll', userId: '123', time: 1700000000 };

    it('should give the name, who saved it and when', () => {
        expect(describeSave(save)).toBe(
            '"before_the_troll" saved by <@123> <t:1700000000:f>'
        );
    });

    it('should leave out who saved it when asked', () => {
        expect(describeSave(save, { user: false })).toBe(
            '"before_the_troll" <t:1700000000:f>'
        );
    });

    it('should cope with a save that has no name', () => {
        expect(describeSave({ ...save, label: '' })).toBe(
            'saved by <@123> <t:1700000000:f>'
        );
        expect(describeSave({ ...save, label: '' }, { user: false })).toBe(
            '<t:1700000000:f>'
        );
    });

    it('should never include a file name', () => {
        expect(describeSave(save)).not.toContain('.qzl');
    });
});

describe('describeSavePath', () => {
    it('should describe the save a file holds', () => {
        expect(
            describeSavePath('/games/zork1-555-123-1700000000-autosave.qzl', { user: false })
        ).toBe('"autosave" <t:1700000000:f>');
    });

    it('should describe an old-format save', () => {
        expect(describeSavePath('/games/sorcerer-1696122293-245714843821277185.qzl')).toBe(
            'saved by <@245714843821277185> <t:1696122293:f>'
        );
    });

    it('should not show the name of a file it cannot read', () => {
        expect(describeSavePath('/games/odd.qzl')).toBe('a save');
    });
});
