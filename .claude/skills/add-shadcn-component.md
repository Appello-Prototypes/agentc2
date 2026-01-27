# Add ShadCN Component Skill

**Trigger**: User asks to add a ShadCN/UI component to the project

**Description**: Adds a new ShadCN UI component to the shared UI package with proper monorepo configuration

## When to Use

- User requests adding a specific ShadCN component (e.g., "add the accordion component")
- User wants to install multiple components at once
- User mentions ShadCN, shadcn/ui, or UI components from the registry

## Automated Script (Recommended)

The easiest way to add ShadCN components is using the automated script from the root directory:

```bash
bun run add-shadcn <component-name> [additional-components...]
```

**Examples**:

- Single component: `bun run add-shadcn accordion`
- Multiple components: `bun run add-shadcn accordion tabs form`

This script automatically:

1. Navigates to `packages/ui`
2. Runs the ShadCN CLI
3. Moves files from `@/components/` to `src/components/` (if needed)
4. Fixes imports (converts `@/` to relative paths)
5. Formats and lints the code
6. Provides a reminder to export the component and create stories

**After running the script, you must manually:**

1. Export the component in `packages/ui/src/components/index.ts`
2. Create a Storybook story file for the component (see "Creating Storybook Stories" section below)

## Creating Storybook Stories

**IMPORTANT**: Every new component MUST have a corresponding Storybook story for documentation and visual testing.

### Story File Template

Create a file named `<component-name>.stories.tsx` in `packages/ui/src/components/`:

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { ComponentName } from "./component-name";

const meta = {
    title: "Components/ComponentName",
    component: ComponentName,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"]
} satisfies Meta<typeof ComponentName>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <ComponentName>
            {/* Example usage */}
        </ComponentName>
    )
};

// Add more story variants as needed
export const Variant: Story = {
    render: () => (
        <ComponentName variant="outline">
            {/* Alternative example */}
        </ComponentName>
    )
};
```

### Story Guidelines

1. **Default Story**: Always include a `Default` story showing the most common usage
2. **Variants**: Create stories for each significant variant or prop combination
3. **Interactive**: Use `args` when the component has simple props that can be controlled
4. **Complex Examples**: Use `render` for more complex layouts or composed components
5. **Documentation**: The `autodocs` tag automatically generates documentation from props

### Common Story Patterns

**Simple Component with Args**:

```typescript
export const Default: Story = {
    args: {
        children: "Click me",
        variant: "default"
    }
};
```

**Complex Component with Render**:

```typescript
export const WithMultipleParts: Story = {
    render: () => (
        <ComponentName>
            <ComponentPart>Content</ComponentPart>
            <ComponentPart>More content</ComponentPart>
        </ComponentName>
    )
};
```

**Multiple Variants Showcase**:

```typescript
export const AllVariants: Story = {
    render: () => (
        <div className="flex gap-4">
            <ComponentName variant="default">Default</ComponentName>
            <ComponentName variant="outline">Outline</ComponentName>
            <ComponentName variant="ghost">Ghost</ComponentName>
        </div>
    )
};
```

## Manual Workflow

If you prefer to run the steps manually:

### Step 1: Navigate to UI Package

```bash
cd packages/ui
```

### Step 2: Add Component(s)

Run the ShadCN CLI to add the component:

```bash
bunx --bun shadcn@latest add <component-name>
```

**Examples**:

- Single component: `bunx --bun shadcn@latest add accordion`
- Multiple components: `bunx --bun shadcn@latest add accordion tabs form`

### Step 3: Fix Imports (CRITICAL)

Immediately run the fix-imports script to move files and convert imports:

```bash
bun run fix-imports
```

**Why this is necessary**: The ShadCN CLI generates components in the `@/components/` directory with `@/` alias imports (e.g., `import { cn } from "@/lib/utils"`). These aliases collide with the frontend and agent apps' `@/` aliases, causing build errors. The fix-imports script:

1. Moves files from `@/components/` to `src/components/`
2. Removes the `@/` directory
3. Converts all `@/` imports to relative imports (e.g., `import { cn } from "../lib/utils"`)

### Step 4: Export Component

Add the new component to `packages/ui/src/components/index.ts`:

```typescript
export * from "./component-name";
```

### Step 5: Create Storybook Story

Create a story file `packages/ui/src/components/<component-name>.stories.tsx`. See the "Creating Storybook Stories" section above for the template and guidelines.

### Step 6: Format and Lint

Navigate back to root and run formatting and linting:

```bash
cd ../.. && bun run format && bun run lint
```

## Complete One-Liner

For single component:

```bash
cd packages/ui && bunx --bun shadcn@latest add <component> && bun run fix-imports && cd ../.. && bun run format && bun run lint
```

For multiple components:

```bash
cd packages/ui && bunx --bun shadcn@latest add <comp1> <comp2> && bun run fix-imports && cd ../.. && bun run format && bun run lint
```

## Important Notes

1. **Always run fix-imports**: Never skip this step. Without it, the build will fail with "Module not found" errors.

2. **Monorepo Path Aliases**: The UI package uses `@/` in `components.json` for ShadCN CLI compatibility, but these must be converted to relative imports for the monorepo to work correctly.

3. **What fix-imports does**:
    - Moves files from `@/components/` to `src/components/` (if `@/` directory exists)
    - Removes the `@/` directory after moving files
    - Converts imports: `from "@/lib/utils"` → `from "../lib/utils"`
    - Converts imports: `from "@/components/button"` → `from "./button"`
    - Converts imports: `from "@/hooks/use-mobile"` → `from "../hooks/use-mobile"`

4. **Component Location**: All components are added to `packages/ui/src/components/` and shared across both frontend and agent apps.

5. **Don't forget to export**: Add the component export to `packages/ui/src/components/index.ts` so it can be imported as `import { ComponentName } from "@repo/ui"`.

## Configuration Files

**packages/ui/components.json**:

- Uses `@/` aliases for ShadCN CLI compatibility
- Does NOT have `resolvedPaths` field (causes validation errors)
- Matches style: `base-nova`, iconLibrary: `hugeicons`

**packages/ui/package.json**:

- Contains `fix-imports` script that handles file relocation and import conversion
- Moves files from `@/components/` to `src/components/` if needed
- Removes the `@/` directory after moving files
- Uses sed to find and replace import patterns

**packages/ui/tsconfig.json**:

- Does NOT have path aliases defined
- Uses relative imports only

## Troubleshooting

**Error: "Invalid configuration found in components.json"**

- Ensure `components.json` does NOT have a `resolvedPaths` field
- Verify aliases use `@/` format, not relative paths

**Error: "Module not found: Can't resolve '@/components/...'"**

- You forgot to run `bun run fix-imports` after adding the component
- Run it now from `packages/ui` directory: `cd packages/ui && bun run fix-imports`
- The script will automatically move files from `@/` to `src/components/` and fix imports
- Then rebuild the app

**Component not found when importing**

- Check that you exported it from `packages/ui/src/components/index.ts`
- Verify the export uses the correct filename

## Example Usage

```bash
# User asks: "Add the accordion component"

cd packages/ui
bunx --bun shadcn@latest add accordion
bun run fix-imports

# Add to packages/ui/src/components/index.ts:
# export * from "./accordion";

cd ../..
bun run format && bun run lint
```

## After Adding

The component can now be imported in both frontend and agent apps:

```typescript
import { Accordion, AccordionItem, AccordionTrigger } from "@repo/ui";
```

**Verify in Storybook**:

```bash
bun run storybook
```

Navigate to `Components/<ComponentName>` to see your new stories and verify the component renders correctly.
