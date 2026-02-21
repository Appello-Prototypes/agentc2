# Accessibility Audit Preparation

## Target Standard

**WCAG 2.1 Level AA Compliance**

## Automated Testing Setup

### axe-core Integration

Install `@axe-core/react` for development-time checking:

```bash
bun add -d @axe-core/react --cwd apps/agent
```

Add to development root layout:

```typescript
if (process.env.NODE_ENV === "development") {
    import("@axe-core/react").then((axe) => {
        axe.default(React, ReactDOM, 1000);
    });
}
```

### CI Accessibility Checks

Add to `security-gates.yml`:

```yaml
- name: Run accessibility audit
  run: npx @axe-core/cli https://staging.agentc2.ai --tags wcag2a,wcag2aa
```

## Critical User Flows to Audit

### Priority 1 (Public-Facing)

1. **Login page** — Form labels, error messages, focus management
2. **Signup page** — Form validation announcements, password requirements
3. **Public embed** — Chat interface keyboard navigation
4. **Error pages** (404, 500) — Meaningful alt text, navigation options

### Priority 2 (Authenticated App)

5. **Agent chat** — Message input, response streaming, tool call display
6. **Agent list** — Table/grid navigation, sorting, filtering
7. **Settings pages** — Form controls, toggle switches, danger zone
8. **Workflow designer** — Canvas navigation, node interaction
9. **Command palette** — Keyboard shortcut, search, navigation

### Priority 3 (Admin)

10. **Dashboard** — Chart alternatives, data tables
11. **User management** — Role assignment, invitation flow

## Known Issues to Fix

### Missing ARIA Labels

- Icon-only buttons (sidebar collapse, close modals)
- Search inputs without visible labels
- Interactive elements in data tables

### Focus Management

- Modal dialogs must trap focus
- Toast notifications must not steal focus
- Sidebar navigation must be keyboard-accessible
- Command palette must handle Escape properly

### Color Contrast

- Verify all text meets 4.5:1 ratio (normal) / 3:1 (large)
- Verify interactive element states (focus, hover, active)
- Test with color blindness simulators

### Keyboard Navigation

- All interactive elements must be reachable via Tab
- Skip-to-content link in main layout
- Logical tab order in forms
- Escape closes modals and drawers

### Screen Reader Support

- Dynamic content updates announced via `aria-live`
- Agent chat messages announced as they stream
- Loading states communicated
- Error states communicated

## Skip-to-Content Link

Add to root layout:

```html
<a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-white focus:p-4"
>
    Skip to main content
</a>
```

## RTL Testing Checklist

For Arabic (`ar`) locale:

- [ ] `dir="rtl"` on `<html>` tag
- [ ] Layout mirrors correctly
- [ ] Icons don't flip (check arrows, progress bars)
- [ ] Text alignment correct
- [ ] Form inputs right-aligned
- [ ] Scrollbars on correct side

## Recommended Audit Firms

- **Deque Systems** — axe-core creators, comprehensive audits
- **Level Access** — Enterprise accessibility consulting
- **WebAIM** — Utah State University, respected evaluations
- **TPGi** — Tools + consulting (formerly The Paciello Group)

## Deliverables Expected

1. VPAT (Voluntary Product Accessibility Template)
2. Detailed findings with WCAG criterion references
3. Remediation priority list
4. Re-audit verification
5. Accessibility statement for website
