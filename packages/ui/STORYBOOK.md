# Storybook for Catalyst UI

This package includes Storybook 10.2.0 for developing and documenting UI components in isolation.

## Getting Started

### Running Storybook

From the **root directory**:

```bash
bun run storybook
```

This will start Storybook on `http://localhost:6006`.

Alternatively, from the **packages/ui** directory:

```bash
bun run storybook
```

### Building Storybook

To build a static version of Storybook (for deployment):

```bash
# From root
bun run build-storybook

# From packages/ui
bun run build-storybook
```

The static files will be generated in `packages/ui/storybook-static/`.

### Using the Theme Switcher

Once Storybook is running at `http://localhost:6006`, you'll see a **Theme** toolbar item in the top toolbar:

1. **Toggle Themes**: Click the theme dropdown in the toolbar (shows ☀️ or 🌙 icon)
2. **Select Mode**: Choose between "Light" or "Dark" from the dropdown menu
3. **Live Updates**: All components update instantly when you switch themes
4. **Persistent**: Theme selection persists as you navigate between stories

The theme switcher works by:

- Setting the `.dark` class on the document root (Tailwind's dark mode strategy)
- Updating CSS custom properties defined in `globals.css`
- Triggering re-renders of all components with the new theme context

## Features

### Dark Mode Support

Storybook is configured with full dark mode support using `next-themes` and Tailwind CSS's class-based dark mode strategy.

**Theme Switcher Toolbar:**

- Click the **Theme** icon (☀️/🌙) in the Storybook toolbar to toggle between light and dark modes
- Themes persist across page navigation
- Works seamlessly with Tailwind's `.dark` class strategy

**How It Works:**

- `ThemeProvider` from `next-themes` manages theme state
- Custom `ThemeSwitcher` component syncs Storybook's global toolbar with the theme provider
- Tailwind CSS applies dark mode styles when the `.dark` class is present on the document
- All components automatically respond to theme changes

### Tailwind CSS v4

All Tailwind styles from `src/styles/globals.css` are automatically loaded in Storybook, ensuring components look identical to how they appear in the apps.

### Vite Builder

Storybook uses Vite for fast rebuilds and HMR (Hot Module Replacement), providing a smooth development experience.

### Essential Addons

The following addons are pre-configured:

- **@storybook/addon-essentials**: Controls, docs, viewport, backgrounds, and more
- **@storybook/addon-interactions**: Test user interactions
- **@storybook/addon-links**: Link between stories

## Writing Stories

Stories are located alongside their components in the `src/components/` directory with the `.stories.tsx` extension.

### Basic Story Example

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta = {
    title: "Components/Button",
    component: Button,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"],
    argTypes: {
        variant: {
            control: "select",
            options: ["default", "outline", "secondary", "ghost", "destructive", "link"]
        }
    }
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        children: "Button",
        variant: "default"
    }
};

export const Outline: Story = {
    args: {
        children: "Button",
        variant: "outline"
    }
};
```

### Custom Render Stories

For more complex stories, use the `render` function:

```tsx
export const AllVariants: Story = {
    render: () => (
        <div className="flex gap-2">
            <Button variant="default">Default</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
        </div>
    )
};
```

## Existing Stories

Example stories are provided for:

- **Button** (`button.stories.tsx`): All button variants, sizes, and states
- **Card** (`card.stories.tsx`): Card layouts with headers, content, footers, and actions
- **Badge** (`badge.stories.tsx`): Badge variants and usage examples
- **Icons** (`icons.stories.tsx`): Curated showcase of commonly used HugeIcons organized into 8 logical categories

The **Icons** story includes:

- **Common Icons**: Browse the most frequently used icons organized by category (Navigation, Files, Communication, User, Calendar, Commerce, Security, AI)
- **Icon Sizes**: Visual reference for different size utilities (size-4 through size-24)
- **Icon Colors**: Examples of theme color variations

**Note**: The HugeIcons free collection contains 4,600+ icons. The story showcases a curated subset of commonly used icons in this project. Additional icons can be imported from `@hugeicons/core-free-icons`.

Use these as templates when creating stories for new components.

## Configuration

### Main Configuration (`.storybook/main.ts`)

- **Stories**: Automatically discovers `*.stories.tsx` and `*.mdx` files in `src/`
- **Framework**: React with Vite builder
- **Addons**: Links, essentials, and interactions
- **Vite Config**:
    - Custom alias resolution for monorepo packages
    - PostCSS with Tailwind CSS v4 plugin for proper style processing

### PostCSS Configuration (`postcss.config.mjs`)

- **Tailwind CSS v4 Plugin**: Processes `@tailwindcss` imports and utility classes
- Required for Storybook to properly compile Tailwind CSS

### Preview Configuration (`.storybook/preview.tsx`)

- **Theme Provider**: Wraps all stories with `ThemeProvider` from `next-themes`
- **Theme Decorator**: Custom `withTheme` decorator that syncs Storybook toolbar with theme state
- **Global Styles**: Imports Tailwind CSS from `src/styles/globals.css`
- **Toolbar Configuration**: Adds a theme switcher to the Storybook toolbar with light/dark options
- **Global Types**: Defines the `theme` global that controls the active theme

**Theme Decorator Architecture:**

- **ThemeWrapper Component**: Internal component that uses `useGlobals()` hook (must be called within decorator context)
- **Implementation**: Reads toolbar state and calls `setTheme()` from `next-themes`
- **Effect**: Automatically updates theme when toolbar selection changes
- **Result**: Seamless integration between Storybook UI and Tailwind's dark mode

## Workflow Integration

### Adding a New Component with Story

1. **Add the component** using shadcn CLI:

    ```bash
    cd packages/ui
    bunx --bun shadcn@latest add <component-name>
    bun run fix-imports
    ```

2. **Create a story file** (`src/components/<component-name>.stories.tsx`):

    ```tsx
    import type { Meta, StoryObj } from "@storybook/react";
    import { ComponentName } from "./component-name";

    const meta = {
        title: "Components/ComponentName",
        component: ComponentName,
        tags: ["autodocs"]
    } satisfies Meta<typeof ComponentName>;

    export default meta;
    type Story = StoryObj<typeof meta>;

    export const Default: Story = {
        args: {
            // component props
        }
    };
    ```

3. **Run Storybook** to see your component:

    ```bash
    bun run storybook
    ```

4. **Format and lint**:

    ```bash
    cd ../.. # back to root
    bun run format
    bun run lint
    ```

## Tips

### Auto-Generated Docs

The `tags: ["autodocs"]` configuration automatically generates documentation pages from your component's props and TypeScript types.

### Controls

Use `argTypes` to customize how controls appear in the Storybook UI:

```tsx
argTypes: {
    variant: {
        control: "select",
        options: ["default", "outline"],
    },
    disabled: {
        control: "boolean",
    },
    size: {
        control: "radio",
        options: ["sm", "md", "lg"],
    },
}
```

### Layout Options

Control story canvas layout with the `layout` parameter:

- `"centered"`: Center the component (good for buttons, badges)
- `"padded"`: Add padding (default)
- `"fullscreen"`: No padding (good for full-width components)

```tsx
parameters: {
    layout: "centered",
}
```

### Testing in Storybook

Use `@storybook/test` for component testing:

```tsx
import { expect, userEvent, within } from "@storybook/test";

export const WithInteraction: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const button = canvas.getByRole("button");

        await userEvent.click(button);
        await expect(button).toHaveTextContent("Clicked");
    }
};
```

## Troubleshooting

### Storybook won't start

- Ensure all dependencies are installed: `bun install`
- Check for TypeScript errors: `bun run type-check`
- Clear Storybook cache: `rm -rf node_modules/.cache/storybook`

### Components not styled correctly

- Verify `src/styles/globals.css` is being imported in `.storybook/preview.tsx`
- Check that Tailwind classes are being applied
- Restart Storybook after CSS changes

### Theme not working

- Ensure `ThemeProvider` is configured in `.storybook/preview.tsx`
- Check that `next-themes` is installed as a dependency
- Verify `globals.css` includes theme CSS variables

## Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Storybook React Documentation](https://storybook.js.org/docs/react/get-started/introduction)
- [Writing Stories](https://storybook.js.org/docs/react/writing-stories/introduction)
- [Storybook Addons](https://storybook.js.org/docs/react/addons/introduction)
