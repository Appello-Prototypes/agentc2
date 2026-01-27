# @repo/ui - Catalyst UI Component Library

Shared UI component library for the Catalyst monorepo, built with [shadcn/ui](https://ui.shadcn.com/), Tailwind CSS v4, and React 19.

## Quick Start

### Development

```bash
# Run Storybook (from root)
bun run storybook

# Run Storybook (from packages/ui)
bun run storybook
```

Storybook will start on `http://localhost:6006`.

**Theme Switcher**: Use the Theme dropdown in the Storybook toolbar to toggle between light and dark modes. All components will update instantly to show their themed appearance.

### Building

```bash
# Build Storybook static site
bun run build-storybook
```

## Features

- 23+ UI components based on shadcn/ui
- Dark mode support with `next-themes`
- TypeScript with full type safety
- Tailwind CSS v4 for styling
- Storybook 8.6.14 for component development and documentation
- Accessible components using `@base-ui/react` primitives

## Components

### Core Components

- Button, Card, Badge, Input, Dialog, Dropdown Menu

### Navigation

- Sidebar, Command Palette, Combobox

### Form Components

- Field, Input Group, Button Group, Select, Textarea

### Feedback

- Alert Dialog, Tooltip, Skeleton

## Adding New Components

1. **Add component using shadcn CLI**:

    ```bash
    cd packages/ui
    bunx --bun shadcn@latest add <component-name>
    bun run fix-imports
    ```

2. **Export from index**:

    Edit `src/components/index.ts` to export the new component.

3. **Create a story** (optional but recommended):

    Create `src/components/<component-name>.stories.tsx` with example usage.

4. **Format and lint**:
    ```bash
    cd ../..  # back to root
    bun run format
    bun run lint
    ```

## Documentation

- **[STORYBOOK.md](./STORYBOOK.md)**: Complete Storybook setup and usage guide
- **[shadcn/ui docs](https://ui.shadcn.com/)**: Component documentation
- **[Tailwind CSS docs](https://tailwindcss.com/)**: Styling reference

## Usage in Apps

Import components from `@repo/ui`:

```tsx
import { Button, Card, Badge } from "@repo/ui";

function MyComponent() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Hello World</CardTitle>
            </CardHeader>
            <CardContent>
                <Button>Click me</Button>
                <Badge>New</Badge>
            </CardContent>
        </Card>
    );
}
```

## Structure

```
packages/ui/
├── .storybook/          # Storybook configuration
├── src/
│   ├── components/      # All UI components
│   ├── config/          # Navigation and menu configs
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions
│   └── styles/          # Global styles and theme
├── components.json      # shadcn/ui configuration
├── STORYBOOK.md        # Storybook documentation
└── package.json
```

## Scripts

- `bun run storybook` - Start Storybook dev server
- `bun run build-storybook` - Build Storybook static site
- `bun run fix-imports` - Convert @/ aliases to relative imports after adding shadcn components

## Theme

The library uses CSS variables for theming. Customize theme colors in `src/styles/globals.css`.

## Contributing

When adding new components:

1. Use the shadcn CLI to maintain consistency
2. Always run `fix-imports` after adding shadcn components
3. Create stories to document component usage
4. Export components from `src/components/index.ts`
5. Format and lint before committing
