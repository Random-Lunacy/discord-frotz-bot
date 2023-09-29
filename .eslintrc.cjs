module.exports = {
    "env": {
        "node": true,
        "commonjs": true,
        "es2021": true
    },
    "plugins": ["sonarjs"],
    "extends": ["plugin:sonarjs/recommended"],
    "overrides": [
        {
            "files": [
                ".eslintrc.{js,cjs}"
            ]
        }
    ],
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "rules": {
        "indent": [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ]
    }
};
