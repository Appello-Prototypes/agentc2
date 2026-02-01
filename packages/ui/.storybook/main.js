const path = require("path");

/** @type {import('@storybook/react-vite').StorybookConfig} */
const config = {
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
        const { mergeConfig } = await import("vite");
        const tailwindcss = (await import("@tailwindcss/postcss")).default;

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
            },
            optimizeDeps: {
                include: ["nanoid", "shiki", "streamdown", "use-stick-to-bottom"]
            }
        });
    }
};

module.exports = config;
