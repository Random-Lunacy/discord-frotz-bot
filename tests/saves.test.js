import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    buildSaveName,
    listSaves,
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
