import { describe, it, expect } from 'vitest';
import { CleanAnsi } from '../cleanAnsi.js';

describe('CleanAnsi', () => {
    describe('replace', () => {
        it('should replace ANSI color codes with empty strings', () => {
            const input = '\x1B[31mRed text\x1B[0m';
            const expected = 'Red text[reset]';
            expect(CleanAnsi.replace(input)).toBe(expected);
        });

        it('should replace multiple ANSI codes correctly', () => {
            const input = '\x1B[1mBold\x1B[22m \x1B[4mUnderline\x1B[24m';
            const expected = '**Bold** *Underline*';
            expect(CleanAnsi.replace(input)).toBe(expected);
        });

        it('should handle text with no ANSI codes', () => {
            const input = 'Plain text';
            expect(CleanAnsi.replace(input)).toBe(input);
        });
    });

    describe('escapeRegex', () => {
        it('should escape special regex characters', () => {
            const input = '.+*?^$()[]{}|\\';
            const expected = '\\.\\+\\*\\?\\^\\$\\(\\)\\[\\]\\{\\}\\|\\\\';
            expect(CleanAnsi.escapeRegex(input)).toBe(expected);
        });
    });
});
