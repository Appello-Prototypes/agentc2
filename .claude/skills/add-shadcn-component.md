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
3. Fixes imports (converts `@/` to relative paths)
4. Formats and lints the code
5. Provides a reminder to export the component

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

Immediately run the fix-imports script to convert `@/` imports to relative imports:

```bash
bun run fix-imports
```

**Why this is necessary**: The ShadCN CLI generates components with `@/` alias imports (e.g., `import { cn } from "@/lib/utils"`). These aliases collide with the frontend and agent apps' `@/` aliases, causing build errors. The fix-imports script converts these to relative imports (e.g., `import { cn } from "../lib/utils"`).

### Step 4: Export Component

Add the new component to `packages/ui/src/components/index.ts`:

```typescript
export * from "./component-name";
```

### Step 5: Format and Lint

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
    - `from "@/lib/utils"` → `from "../lib/utils"`
    - `from "@/components/button"` → `from "./button"`
    - `from "@/hooks/use-mobile"` → `from "../hooks/use-mobile"`

4. **Component Location**: All components are added to `packages/ui/src/components/` and shared across both frontend and agent apps.

5. **Don't forget to export**: Add the component export to `packages/ui/src/components/index.ts` so it can be imported as `import { ComponentName } from "@repo/ui"`.

## Configuration Files

**packages/ui/components.json**:

- Uses `@/` aliases for ShadCN CLI compatibility
- Does NOT have `resolvedPaths` field (causes validation errors)
- Matches style: `base-nova`, iconLibrary: `hugeicons`

**packages/ui/package.json**:

- Contains `fix-imports` script that handles import conversion
- Uses sed to find and replace import patterns

**packages/ui/tsconfig.json**:

- Does NOT have path aliases defined
- Uses relative imports only

## Troubleshooting

**Error: "Invalid configuration found in components.json"**

- Ensure `components.json` does NOT have a `resolvedPaths` field
- Verify aliases use `@/` format, not relative paths

**Error: "Module not found: Can't resolve '@/components/...'"**

- You forgot to run `bun run fix-imports`
- Run it now, then rebuild

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
