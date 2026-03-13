# UIS HTML Template

This is the boilerplate structure for a Unified Implementation Spec. Copy and adapt -- replace all `{PLACEHOLDER}` values with real content.

## CSS Foundation

Every UIS starts with these CSS variables and base styles:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{Phase Tag}: {Feature Title} — UIS</title>
        <!-- Pick a UNIQUE pair of fonts per UIS. Never reuse the same combo. -->
        <link
            href="https://fonts.googleapis.com/css2?family={DisplayFont}:wght@400;500;600;700&family={MonoFont}:wght@400;500;600&display=swap"
            rel="stylesheet"
        />
        <style>
            :root {
                --bg-primary: #08090b;
                --bg-surface: #0e1015;
                --bg-elevated: #14161c;
                --bg-muted: #1a1c24;
                --bg-accent: #22242e;
                --border-subtle: #252836;
                --border-default: #2e3142;
                --text-primary: #e4e5eb;
                --text-secondary: #9295a5;
                --text-muted: #626580;
                --green-500: #10b981;
                --green-bg: rgba(16, 185, 129, 0.1);
                --green-border: rgba(16, 185, 129, 0.2);
                --amber-500: #f59e0b;
                --amber-bg: rgba(245, 158, 11, 0.1);
                --amber-border: rgba(245, 158, 11, 0.2);
                --blue-500: #3b82f6;
                --blue-bg: rgba(59, 130, 246, 0.08);
                --blue-border: rgba(59, 130, 246, 0.2);
                --red-500: #ef4444;
                --red-bg: rgba(239, 68, 68, 0.08);
                --red-border: rgba(239, 68, 68, 0.2);
                --purple-500: #8b5cf6;
            }
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family:
                    "{DisplayFont}",
                    -apple-system,
                    sans-serif;
                background: var(--bg-primary);
                color: var(--text-primary);
                padding: 48px 40px;
                line-height: 1.6;
            }
            code,
            .mono {
                font-family: "{MonoFont}", monospace;
            }
            .hidden {
                display: none;
            }
        </style>
    </head>
</html>
```

## Font Pairs (rotate -- never repeat)

| Display Font      | Mono Font       | Vibe                 |
| ----------------- | --------------- | -------------------- |
| Space Grotesk     | IBM Plex Mono   | Technical, precise   |
| DM Sans           | JetBrains Mono  | Clean, engineering   |
| Outfit            | Fira Code       | Modern, approachable |
| Plus Jakarta Sans | Source Code Pro | Professional, warm   |
| Manrope           | Inconsolata     | Geometric, minimal   |
| Sora              | Overpass Mono   | Futuristic, sharp    |
| Urbanist          | Roboto Mono     | Sleek, neutral       |
| Nunito Sans       | Ubuntu Mono     | Friendly, readable   |

## Section 1: Header

```html
<div class="header">
    <div class="phase-tag">{PHASE}</div>
    <h1>{Feature Title}</h1>
    <p>{One paragraph: what it does, why it matters, key constraint}</p>
</div>
```

CSS for header (add to `<style>`):

```css
.header {
    max-width: 940px;
    margin: 0 auto 64px;
    text-align: center;
}
.phase-tag {
    display: inline-block;
    padding: 5px 16px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    font-family: "{MonoFont}", monospace;
    margin-bottom: 16px;
    /* Use green for foundation phases, red for destructive, blue for enhancement */
    background: var(--green-bg);
    border: 1px solid var(--green-border);
    color: var(--green-500);
}
.header h1 {
    font-size: 38px;
    font-weight: 700;
    letter-spacing: -0.8px;
    margin-bottom: 14px;
    background: linear-gradient(135deg, #e4e5eb 0%, #9295a5 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}
.header p {
    color: var(--text-secondary);
    font-size: 16px;
    max-width: 680px;
    margin: 0 auto;
}
```

## Section 2: Architecture / Flow

Use for features with API routes. Build with styled divs and arrow characters.

```html
<div class="section">
    <div class="section-eyebrow">Architecture</div>
    <div class="section-title">{Flow Name}</div>
    <div class="chrome">
        <div class="chrome-bar">
            <div class="chrome-dots">
                <span class="dot dot-r"></span><span class="dot dot-y"></span
                ><span class="dot dot-g"></span>
            </div>
            {filename or context}
        </div>
        <div class="chrome-body">
            <div class="flow-container">
                <div class="flow-node">
                    <div class="flow-node-title">{Step}</div>
                    <div class="flow-node-desc">{File}</div>
                </div>
                <div class="flow-arrow">&rarr;</div>
                <!-- repeat -->
            </div>
        </div>
    </div>
</div>
```

## Section 3: Interactive Mockup

The most important section. Must be interactive with state toggles.

```html
<div class="section">
    <div class="section-eyebrow">UI Mockup</div>
    <div class="section-title">{Mockup Title}</div>
    <div class="section-desc">{Description of what the user is seeing}</div>

    <!-- State toggle bar (if feature has multiple states) -->
    <div class="toggle-group">
        <button class="toggle-btn active" onclick="showState('default', this)">Default</button>
        <button class="toggle-btn" onclick="showState('loading', this)">Loading</button>
        <button class="toggle-btn" onclick="showState('success', this)">Success</button>
        <button class="toggle-btn" onclick="showState('error', this)">Error</button>
    </div>

    <div class="chrome">
        <div class="chrome-bar">...</div>
        <div class="chrome-body">
            <!-- Build the actual UI mockup here using HTML/CSS -->
            <!-- Use realistic data, not placeholders -->
        </div>
    </div>
</div>
```

## Section 4: Files Changed

```html
<div class="section">
    <div class="section-eyebrow">Manifest</div>
    <div class="section-title">Files Changed</div>
    <table class="spec-table">
        <thead>
            <tr>
                <th>Action</th>
                <th>File</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>New</td>
                <td><code>{full/path/to/file.ts}</code></td>
                <td>{One-line description}</td>
            </tr>
            <tr>
                <td>Modify</td>
                <td><code>{full/path/to/file.ts}</code></td>
                <td>{One-line description}</td>
            </tr>
        </tbody>
    </table>
</div>
```

## Section 5: Real Data Shapes

```html
<div class="section">
    <div class="section-eyebrow">Data</div>
    <div class="section-title">Production Data Shapes</div>
    <div class="section-desc">
        Actual JSON from the database. These are the shapes the code must handle.
    </div>

    <!-- Use type cards to switch between data types -->
    <div class="type-grid">
        <div class="type-card active" onclick="showDataType('type1')">
            <div class="type-card-icon">{emoji}</div>
            <div class="type-card-name">{type name}</div>
        </div>
        <!-- more type cards -->
    </div>

    <!-- JSON blocks per type -->
    <div id="data-type1" class="chrome">
        <div class="chrome-bar">...</div>
        <div class="chrome-body">
            <pre class="raw-pre">{actual JSON from database}</pre>
        </div>
    </div>
</div>
```

## Section 6: Step-by-Step Implementation

```html
<div class="section">
    <div class="section-eyebrow">Implementation</div>
    <div class="section-title">Step-by-Step</div>

    <!-- Repeat per step -->
    <div class="impl-step">
        <h3>Step {N}: {Title}</h3>
        <div class="impl-meta">
            <span><strong>File:</strong> <code>{full/path}</code></span>
            <span><strong>Pattern:</strong> <code>{path/to/reference/file}</code></span>
        </div>

        <!-- TypeScript interfaces -->
        <div class="detail-section">
            <div class="detail-section-label">Interfaces</div>
            <pre class="raw-pre">{TypeScript interface code}</pre>
        </div>

        <!-- Imports -->
        <div class="detail-section">
            <div class="detail-section-label">Key Imports</div>
            <pre class="raw-pre">{import statements}</pre>
        </div>

        <!-- Logic -->
        <div class="detail-section">
            <div class="detail-section-label">Logic</div>
            <ol>
                {numbered logic steps}
            </ol>
        </div>

        <!-- Error responses (for API routes) -->
        <table class="spec-table">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Condition</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>401</td>
                    <td>Unauthenticated</td>
                </tr>
                <tr>
                    <td>409</td>
                    <td>{Conflict condition}</td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
```

## Sections 7-13: Tables

These sections all follow the same `spec-table` pattern:

```html
<div class="section">
    <div class="section-eyebrow">{Category}</div>
    <div class="section-title">{Title}</div>
    <table class="spec-table">
        <thead>
            <tr>
                <th>{Col1}</th>
                <th>{Col2}</th>
                <th>{Col3}</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{val}</td>
                <td>{val}</td>
                <td>{val}</td>
            </tr>
        </tbody>
    </table>
</div>
```

**Section-specific column layouts:**

| Section                   | Columns                       |
| ------------------------- | ----------------------------- |
| 7. Rendering Rules        | Detection, Pattern, Rendering |
| 8. Edge Cases             | Scenario, Backend, Frontend   |
| 9. Component Architecture | Component/Function, Purpose   |
| 11. Playwright Test Plan  | #, Step, Assertion            |
| 13. Effort Estimate       | Task, Estimate                |

**Section 10 (Data Flow)** uses a styled trace block:

```html
<div class="section">
    <div class="section-eyebrow">Data Flow</div>
    <div class="section-title">Call Chain</div>
    <pre class="raw-pre" style="font-size: 12px; line-height: 1.8;">
User clicks "{action}"
    └─ {Component}: {state change}
        └─ {Parent}: {callback}
            └─ {Hook}.{function}()
                └─ POST /api/{route}
                    └─ {DB mutation}
                └─ On success: {side effects}
  </pre
    >
</div>
```

**Section 12 (Acceptance Criteria)** uses checkboxes:

```html
<div class="section">
    <div class="section-eyebrow">Acceptance</div>
    <div class="section-title">Criteria</div>
    <div style="font-size: 13px; color: var(--text-secondary); line-height: 2;">
        ☐ {Testable statement 1}<br />
        ☐ {Testable statement 2}<br />
        ☐ {Testable statement 3}<br />
    </div>
</div>
```

## Shared CSS Classes

Add all of these to the `<style>` block:

```css
/* Sections */
.section {
    max-width: 940px;
    margin: 0 auto 60px;
}
.section-eyebrow {
    font-family: "{MonoFont}", monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
}
.section-title {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 12px;
    letter-spacing: -0.3px;
}
.section-desc {
    color: var(--text-secondary);
    font-size: 14px;
    margin-bottom: 28px;
    line-height: 1.7;
}
.divider {
    height: 1px;
    background: var(--border-subtle);
    margin: 56px 0;
}

/* Chrome frame */
.chrome {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}
.chrome-bar {
    background: var(--bg-muted);
    padding: 9px 16px;
    font-family: "{MonoFont}", monospace;
    font-size: 11px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    gap: 10px;
}
.chrome-dots {
    display: flex;
    gap: 5px;
}
.dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}
.dot-r {
    background: #ff5f57;
}
.dot-y {
    background: #febc2e;
}
.dot-g {
    background: #28c840;
}
.chrome-body {
    padding: 24px;
}

/* Spec table */
.spec-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}
.spec-table th {
    text-align: left;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-family: "{MonoFont}", monospace;
}
.spec-table td {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    vertical-align: top;
}
.spec-table td:first-child {
    color: var(--text-primary);
    font-weight: 500;
}
.spec-table code {
    font-family: "{MonoFont}", monospace;
    background: var(--bg-muted);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    color: var(--purple-500);
}

/* Badges */
.badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
}
.badge-green {
    background: var(--green-bg);
    color: var(--green-500);
    border: 1px solid var(--green-border);
}
.badge-amber {
    background: var(--amber-bg);
    color: var(--amber-500);
    border: 1px solid var(--amber-border);
}
.badge-red {
    background: var(--red-bg);
    color: var(--red-500);
    border: 1px solid var(--red-border);
}
.badge-blue {
    background: var(--blue-bg);
    color: var(--blue-500);
    border: 1px solid var(--blue-border);
}
.badge-muted {
    background: var(--bg-accent);
    color: var(--text-muted);
    border: 1px solid var(--border-default);
}

/* Toggle group */
.toggle-group {
    display: flex;
    gap: 4px;
    margin-bottom: 24px;
    background: var(--bg-muted);
    border-radius: 10px;
    padding: 4px;
    width: fit-content;
}
.toggle-btn {
    padding: 8px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--text-muted);
    transition: all 0.2s;
    font-family: "{DisplayFont}", sans-serif;
}
.toggle-btn.active {
    background: var(--bg-accent);
    color: var(--text-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
.toggle-btn:hover:not(.active) {
    color: var(--text-secondary);
}

/* Callout */
.callout {
    background: var(--blue-bg);
    border: 1px solid var(--blue-border);
    border-left: 3px solid var(--blue-500);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.6;
}
.callout strong {
    color: var(--blue-500);
}

/* Flow diagram */
.flow-container {
    display: flex;
    align-items: center;
    padding: 20px 0;
    overflow-x: auto;
}
.flow-node {
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    padding: 14px 18px;
    min-width: 140px;
    text-align: center;
    flex-shrink: 0;
}
.flow-node-title {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 4px;
}
.flow-node-desc {
    font-size: 10px;
    color: var(--text-muted);
}
.flow-node.active {
    border-color: var(--blue-500);
    box-shadow: 0 0 0 2px var(--blue-bg);
}
.flow-arrow {
    color: var(--text-muted);
    font-size: 18px;
    padding: 0 8px;
    flex-shrink: 0;
}

/* Type cards */
.type-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 28px;
}
.type-card {
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    padding: 14px;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s;
}
.type-card:hover {
    border-color: var(--border-default);
}
.type-card.active {
    border-color: var(--green-500);
    box-shadow: 0 0 0 1px var(--green-border);
}
.type-card-icon {
    font-size: 22px;
    margin-bottom: 6px;
}
.type-card-name {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 3px;
}
.type-card-desc {
    font-size: 10px;
    color: var(--text-muted);
}

/* Raw / code blocks */
.raw-pre {
    background: var(--bg-muted);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 14px;
    font-family: "{MonoFont}", monospace;
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.6;
    max-height: 260px;
    overflow: auto;
    white-space: pre-wrap;
}

/* Implementation step */
.impl-step {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
}
.impl-step h3 {
    font-size: 16px;
    margin-bottom: 12px;
}
.impl-meta {
    display: flex;
    gap: 24px;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 16px;
}
.detail-section {
    margin-bottom: 14px;
}
.detail-section-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
    font-family: "{MonoFont}", monospace;
}
```
