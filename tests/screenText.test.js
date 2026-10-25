import { describe, it, expect } from 'vitest';
import {
    describeUpperWindow,
    fence,
    fenceAlignedText,
    isAligned,
    isAnyKeyPrompt,
    trimRows,
} from '../screenText.js';

describe('fence', () => {
    it('should put text in a code block', () => {
        expect(fence('a\nb')).toBe('```\na\nb\n```');
    });

    it('should stop text from ending the block early', () => {
        expect(fence('x ``` y')).toBe('```\nx \'\'\' y\n```');
    });
});

describe('trimRows', () => {
    it('should drop empty rows at the ends, trailing spaces and the common indent', () => {
        expect(trimRows(['', '    A   ', '      B', '', '   '])).toEqual(['A', '  B']);
    });

    it('should return nothing for a blank window', () => {
        expect(trimRows(['   ', ''])).toEqual([]);
    });

    it('should keep blank rows between lines', () => {
        expect(trimRows(['A', '', 'B'])).toEqual(['A', '', 'B']);
    });
});

describe('describeUpperWindow', () => {
    it('should report nothing for a blank window', () => {
        expect(describeUpperWindow(['    ', ''])).toEqual({ status: null, block: null });
        expect(describeUpperWindow([])).toEqual({ status: null, block: null });
    });

    it('should turn one row into a status line, joining the columns', () => {
        const row = ' Sherlock Holmes     Saturday   5:00 a.m.      Score:    0';

        expect(describeUpperWindow([row]).status).toBe('Sherlock Holmes · Saturday · 5:00 a.m. · Score: 0');
    });

    it('should leave a one column status line alone', () => {
        expect(describeUpperWindow(['      Palace Gate'])).toEqual({
            status: 'Palace Gate',
            block: null,
        });
    });

    it('should turn several rows into a code block that keeps the layout', () => {
        const { status, block } = describeUpperWindow([
            '   Mode:  Communications      Time:  7:07pm',
            '   Location:  (undefined)     Date:  3/16/2031',
        ]);

        expect(status).toBeNull();
        expect(block).toBe(
            '```\nMode:  Communications      Time:  7:07pm\nLocation:  (undefined)     Date:  3/16/2031\n```'
        );
    });

    it('should limit how much of a tall window is sent', () => {
        const rows = Array.from({ length: 60 }, (_, i) => `line ${i}`);

        const lines = describeUpperWindow(rows).block.split('\n');

        // Two fence lines plus at most 30 rows
        expect(lines.length).toBeLessThanOrEqual(32);
    });

    it('should keep a wide window within one message', () => {
        const rows = Array.from({ length: 30 }, () => 'x'.repeat(80));

        expect(describeUpperWindow(rows).block.length).toBeLessThanOrEqual(1900);
    });
});

describe('isAligned', () => {
    it('should be true when a short line is indented four or more spaces', () => {
        expect(isAligned('"A quote"\n      -- Someone')).toBe(true);
    });

    it('should be true for a wide gap inside a line', () => {
        expect(isAligned('Name:       Mitch')).toBe(true);
    });

    it('should be false for ordinary and lightly indented text', () => {
        expect(isAligned('You are carrying:\n  A leaflet')).toBe(false);
        expect(isAligned('A plain sentence.')).toBe(false);
    });

    it('should be false for long lines, which are prose', () => {
        expect(isAligned('    ' + 'word '.repeat(30))).toBe(false);
    });
});

describe('fenceAlignedText', () => {
    it('should fence only the paragraphs whose layout matters', () => {
        const text = 'Intro text.\n\n"Quote"\n         -- Author\n\nOutro text.';

        expect(fenceAlignedText(text)).toBe(
            'Intro text.\n\n```\n"Quote"\n         -- Author\n```\n\nOutro text.'
        );
    });

    it('should leave plain text unchanged', () => {
        const text = 'One.\n\nTwo.\nThree.';

        expect(fenceAlignedText(text)).toBe(text);
    });

    it('should not fence a paragraph too big for one message', () => {
        const big = Array.from({ length: 40 }, () => '    ' + 'x'.repeat(70)).join('\n');

        expect(fenceAlignedText(big)).toBe(big);
    });
});

describe('isAnyKeyPrompt', () => {
    it.each([
        '[Press any key to begin.]',
        '[Hit any key to continue.]',
        '[Press any key.]',
        'Copyright (C)1986 Infocom, Inc.\n\n[Press any key to begin.]',
        'Strike a key to go on',
        '[Press RETURN to continue.]',
        '[Press SPACE to continue]',
        '[More]  Touch any key',
    ])('should recognise %j', (text) => {
        expect(isAnyKeyPrompt(text)).toBe(true);
    });

    it.each([
        'Do you want to quit? (y/n)',
        'Which way? [N/S/E/W]',
        'Choose a number from 1 to 5:',
        'You press the red button. Nothing happens.',
        '',
    ])('should not mistake %j for a pause', (text) => {
        expect(isAnyKeyPrompt(text)).toBe(false);
    });

    it('should only look at the end of the output', () => {
        const text = '[Press any key to continue.]\n\nA long passage.\n\nMore story.\n\nWhat now?';

        expect(isAnyKeyPrompt(text)).toBe(false);
    });
});
