import type { Preview } from "@storybook/react";
import type { Decorator } from "@storybook/react";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect } from "react";
import "../src/styles/globals.css";
import React from "react";

const ThemeWrapper: React.FC<{ children: React.ReactNode; theme: string }> = ({
    children,
    theme
}) => {
    const { setTheme } = useTheme();

    useEffect(() => {
        setTheme(theme);
    }, [theme, setTheme]);

    return <>{children}</>;
};

const withTheme: Decorator = (Story, context) => {
    const theme = context.globals.theme || "light";

    return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <ThemeWrapper theme={theme}>
                <div className="bg-background text-foreground">
                    <Story />
                </div>
            </ThemeWrapper>
        </ThemeProvider>
    );
};

const preview: Preview = {
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i
            }
        },
        backgrounds: {
            disable: true
        }
    },
    decorators: [withTheme],
    globalTypes: {
        theme: {
            description: "Global theme for components",
            defaultValue: "light",
            toolbar: {
                title: "Theme",
                icon: "circlehollow",
                items: [
                    { value: "light", icon: "sun", title: "Light" },
                    { value: "dark", icon: "moon", title: "Dark" }
                ],
                dynamicTitle: true
            }
        }
    }
};

export default preview;
