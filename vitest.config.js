import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary', 'json'],
            reportOnFailure: true,

            exclude: ['node_modules/', 'tests/', 'coverage/', '**/*.config.js'],
        },
    },
});
