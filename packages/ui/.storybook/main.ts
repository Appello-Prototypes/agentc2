import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/postcss";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
    stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: [
        "@storybook/addon-links",
        "@storybook/addon-essentials",
        "@storybook/addon-interactions"
    ],
    framework: {
        name: "@storybook/react-vite",
        options: {}
    },
    async viteFinal(config) {
        return mergeConfig(config, {
            resolve: {
                alias: {
                    // Map internal package aliases for Storybook
                    "@repo/auth": path.resolve(__dirname, "../../auth/src")
                }
            },
            css: {
                postcss: {
                    plugins: [tailwindcss()]
                }
            }
        });
    }
};

export default config;
