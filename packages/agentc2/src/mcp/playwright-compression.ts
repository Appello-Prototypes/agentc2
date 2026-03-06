/**
 * Playwright Snapshot Compression
 *
 * Reduces Playwright MCP tool result size by filtering accessibility tree
 * snapshots to only interactive elements. Mirrors how Cursor's browser MCP
 * uses `compact` and `interactive` modes to prevent context explosion.
 *
 * A typical full page snapshot is 15-25K tokens. After compression,
 * it's usually 500-2000 tokens — keeping only the elements an agent
 * can actually interact with (buttons, inputs, links, etc.).
 */

const INTERACTIVE_ROLES = new Set([
    "textbox",
    "button",
    "link",
    "combobox",
    "radio",
    "checkbox",
    "option",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "tab",
    "switch",
    "slider",
    "spinbutton",
    "searchbox",
    "textarea",
    "select",
    "listbox",
    "treeitem",
    "row",
    "cell",
    "gridcell"
])

const STRUCTURAL_ROLES = new Set(["generic", "group", "region", "section", "article", "main", "navigation", "complementary", "banner", "contentinfo", "form", "dialog", "alertdialog", "alert"])

const KEEP_PROPERTY_PREFIXES = ["/url:", "/value:", "/checked:", "/selected:", "/disabled:", "/placeholder:"]

interface ParsedLine {
    indent: number
    role: string
    text: string
    ref: string
    attrs: string[]
    changed: boolean
    isProperty: boolean
    raw: string
}

function parseLine(line: string): ParsedLine | null {
    if (!line.trim()) return null

    const indent = line.search(/\S/)
    if (indent < 0) return null

    const trimmed = line.trim()

    if (trimmed.startsWith("- /") || trimmed.startsWith("/")) {
        return {
            indent,
            role: "__property__",
            text: "",
            ref: "",
            attrs: [],
            changed: trimmed.includes("<changed>"),
            isProperty: true,
            raw: line
        }
    }

    const changed = trimmed.includes("<changed>")
    const cleaned = trimmed.replace(/- /, "").replace(/<changed>\s*/g, "")

    const roleMatch = cleaned.match(/^(\w[\w-]*)/)
    const role = roleMatch ? roleMatch[1] : ""

    const textMatch = cleaned.match(/"([^"]*)"/)
    const text = textMatch ? textMatch[1] : ""

    const refMatch = cleaned.match(/\[ref=(\w+)\]/)
    const ref = refMatch ? refMatch[1] : ""

    const attrMatches = cleaned.match(/\[(?!ref=)[^\]]+\]/g) || []
    const attrs = attrMatches.map((a) => a.slice(1, -1))

    return { indent, role, text, ref, attrs, changed, isProperty: false, raw: line }
}

function isInteractive(parsed: ParsedLine): boolean {
    if (parsed.isProperty) return false
    return INTERACTIVE_ROLES.has(parsed.role)
}

function isHeading(parsed: ParsedLine): boolean {
    return parsed.role === "heading" || /^h[1-6]$/.test(parsed.role)
}

function isTextLabel(parsed: ParsedLine): boolean {
    return parsed.role === "text" || parsed.role === "img"
}

/**
 * Compress a Playwright accessibility tree snapshot to only interactive elements.
 *
 * Keeps: interactive elements (textbox, button, link, etc.), headings for context,
 * text labels adjacent to interactive elements, property lines (/url:, /value:),
 * and elements marked as <changed>.
 */
export function compressSnapshot(yamlText: string): string {
    const lines = yamlText.split("\n")
    const parsed = lines.map(parseLine)

    const keepIndices = new Set<number>()
    let totalElements = 0
    let keptElements = 0

    for (let i = 0; i < parsed.length; i++) {
        const p = parsed[i]
        if (!p) continue
        if (p.isProperty) continue
        totalElements++

        const shouldKeep =
            isInteractive(p) ||
            isHeading(p) ||
            p.changed ||
            (p.role === "img" && p.text)

        if (shouldKeep) {
            keepIndices.add(i)
            keptElements++

            // Keep property lines that follow this element
            for (let j = i + 1; j < parsed.length; j++) {
                const next = parsed[j]
                if (!next) continue
                if (next.indent <= p.indent && !next.isProperty) break
                if (next.isProperty && KEEP_PROPERTY_PREFIXES.some((pf) => next.raw.trim().replace("- ", "").startsWith(pf))) {
                    keepIndices.add(j)
                }
            }

            // Keep text labels immediately before this element (siblings at same indent)
            for (let j = i - 1; j >= 0; j--) {
                const prev = parsed[j]
                if (!prev) continue
                if (prev.indent < p.indent) break
                if (prev.indent === p.indent && isTextLabel(prev)) {
                    keepIndices.add(j)
                    keptElements++
                } else if (prev.indent === p.indent) {
                    break
                }
            }
        }
    }

    if (keepIndices.size === 0) {
        return yamlText.length > 500 ? yamlText.substring(0, 500) + "\n..." : yamlText
    }

    const sortedIndices = Array.from(keepIndices).sort((a, b) => a - b)

    // Flatten: normalize indentation so the output is readable
    // but doesn't preserve the deep nesting of the original
    const compressedLines: string[] = []
    for (const idx of sortedIndices) {
        const p = parsed[idx]!
        compressedLines.push(p.raw.replace(/^ {4,}/, "  "))
    }

    const filtered = totalElements - keptElements
    const header = filtered > 0 ? `[${keptElements} interactive elements shown, ${filtered} structural elements hidden]\n` : ""

    return header + compressedLines.join("\n")
}

/**
 * Compress a full Playwright MCP tool result.
 *
 * Detects the `### Snapshot` section in the result text, compresses the
 * accessibility tree within it, and preserves the rest of the output
 * (executed code, page URL/title, error messages).
 */
export function compressPlaywrightResult(result: unknown): unknown {
    if (result === null || result === undefined) return result

    // Playwright MCP results come as {content: [{type: "text", text: "..."}]}
    if (typeof result === "object" && "content" in (result as Record<string, unknown>)) {
        const content = (result as { content: Array<{ type: string; text: string }> }).content
        if (Array.isArray(content)) {
            const compressed = content.map((item) => {
                if (item.type === "text" && typeof item.text === "string") {
                    return { ...item, text: compressPlaywrightText(item.text) }
                }
                return item
            })
            return { ...result, content: compressed }
        }
    }

    if (typeof result === "string") {
        return compressPlaywrightText(result)
    }

    return result
}

/**
 * Compress the text portion of a Playwright result.
 * Handles the markdown format: ### Ran Playwright code, ### Page, ### Snapshot
 */
function compressPlaywrightText(text: string): string {
    const snapshotMarker = "### Snapshot"
    const snapshotIdx = text.indexOf(snapshotMarker)
    if (snapshotIdx === -1) return text

    const beforeSnapshot = text.substring(0, snapshotIdx)

    // Extract the YAML block from the snapshot section
    const afterMarker = text.substring(snapshotIdx)
    const yamlStart = afterMarker.indexOf("```yaml\n")
    const yamlEnd = afterMarker.lastIndexOf("```")

    if (yamlStart === -1 || yamlEnd === -1 || yamlEnd <= yamlStart) {
        // No parseable YAML block — just truncate
        return beforeSnapshot + snapshotMarker + "\n[snapshot compressed - no parseable YAML]\n"
    }

    const yamlContent = afterMarker.substring(yamlStart + 8, yamlEnd)
    const compressed = compressSnapshot(yamlContent)

    return beforeSnapshot + snapshotMarker + " (compressed)\n```yaml\n" + compressed + "\n```"
}

/**
 * Check if a tool name is a Playwright browser tool.
 */
export function isPlaywrightTool(toolName: string): boolean {
    return toolName.startsWith("playwright_browser_") || toolName.startsWith("playwright_")
}

/**
 * Check if a Playwright tool typically returns large snapshots.
 * Tools like click, type, navigate, snapshot return full page state.
 * Tools like close, install, press_key return small results.
 */
export function isSnapshotProducingTool(toolName: string): boolean {
    const snapshotTools = [
        "playwright_browser_snapshot",
        "playwright_browser_navigate",
        "playwright_browser_click",
        "playwright_browser_type",
        "playwright_browser_hover",
        "playwright_browser_select_option",
        "playwright_browser_fill_form",
        "playwright_browser_drag",
        "playwright_browser_wait_for",
        "playwright_browser_navigate_back",
        "playwright_browser_evaluate",
        "playwright_browser_run_code"
    ]
    return snapshotTools.includes(toolName)
}
