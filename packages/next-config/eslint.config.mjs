import js from "@eslint/js";
import tseslint from "typescript-eslint";

const config = [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "warn"
        }
    }
];

export default config;
