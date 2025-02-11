import globals from "globals";

export default [{
    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.commonjs,
        },

        ecmaVersion: "latest",
        sourceType: "module",
    },

    rules: {
        indent: ["error", 4],
        "linebreak-style": ["error", "unix"],
        quotes: ["error", "single"],
        semi: ["error", "always"],
    },
}, {
    files: ["**/.eslintrc.{js,cjs}"],
}];