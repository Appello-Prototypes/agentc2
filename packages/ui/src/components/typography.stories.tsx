import type { Meta, StoryObj } from "@storybook/react";

const meta = {
    title: "Foundation/Typography",
    parameters: {
        layout: "padded"
    },
    tags: ["autodocs"]
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Headings: Story = {
    render: () => (
        <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">Heading 1</h1>
            <h2 className="text-3xl font-semibold tracking-tight">Heading 2</h2>
            <h3 className="text-2xl font-semibold tracking-tight">Heading 3</h3>
            <h4 className="text-xl font-semibold tracking-tight">Heading 4</h4>
            <h5 className="text-lg font-semibold tracking-tight">Heading 5</h5>
            <h6 className="text-base font-semibold tracking-tight">Heading 6</h6>
        </div>
    )
};

export const Paragraphs: Story = {
    render: () => (
        <div className="max-w-2xl space-y-4">
            <p className="text-base">
                This is a default paragraph with base text size. Lorem ipsum dolor sit amet,
                consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore
                magna aliqua.
            </p>
            <p className="text-sm">
                This is a small paragraph. Ut enim ad minim veniam, quis nostrud exercitation
                ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
            <p className="text-xs">
                This is an extra small paragraph. Duis aute irure dolor in reprehenderit in
                voluptate velit esse cillum dolore eu fugiat nulla pariatur.
            </p>
            <p className="text-lg">
                This is a large paragraph. Excepteur sint occaecat cupidatat non proident, sunt in
                culpa qui officia deserunt mollit anim id est laborum.
            </p>
        </div>
    )
};

export const FontWeights: Story = {
    render: () => (
        <div className="space-y-2">
            <p className="font-light">Light weight text (300)</p>
            <p className="font-normal">Normal weight text (400)</p>
            <p className="font-medium">Medium weight text (500)</p>
            <p className="font-semibold">Semibold weight text (600)</p>
            <p className="font-bold">Bold weight text (700)</p>
        </div>
    )
};

export const TextColors: Story = {
    render: () => (
        <div className="space-y-2">
            <p className="text-foreground">Foreground text color</p>
            <p className="text-muted-foreground">Muted foreground text color</p>
            <p className="text-primary">Primary text color</p>
            <p className="text-secondary-foreground">Secondary text color</p>
            <p className="text-destructive">Destructive text color</p>
            <p className="text-accent-foreground">Accent text color</p>
        </div>
    )
};

export const TextSizes: Story = {
    render: () => (
        <div className="space-y-2">
            <p className="text-xs">Extra small text (xs)</p>
            <p className="text-sm">Small text (sm)</p>
            <p className="text-base">Base text (base)</p>
            <p className="text-lg">Large text (lg)</p>
            <p className="text-xl">Extra large text (xl)</p>
            <p className="text-2xl">2X large text (2xl)</p>
            <p className="text-3xl">3X large text (3xl)</p>
            <p className="text-4xl">4X large text (4xl)</p>
        </div>
    )
};

export const LineHeights: Story = {
    render: () => (
        <div className="max-w-2xl space-y-4">
            <div>
                <p className="mb-2 text-sm font-medium">Tight (leading-tight)</p>
                <p className="text-sm leading-tight">
                    This paragraph has tight line height. Lorem ipsum dolor sit amet, consectetur
                    adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna
                    aliqua.
                </p>
            </div>
            <div>
                <p className="mb-2 text-sm font-medium">Normal (leading-normal)</p>
                <p className="text-sm leading-normal">
                    This paragraph has normal line height. Lorem ipsum dolor sit amet, consectetur
                    adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna
                    aliqua.
                </p>
            </div>
            <div>
                <p className="mb-2 text-sm font-medium">Relaxed (leading-relaxed)</p>
                <p className="text-sm leading-relaxed">
                    This paragraph has relaxed line height. Lorem ipsum dolor sit amet, consectetur
                    adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna
                    aliqua.
                </p>
            </div>
        </div>
    )
};

export const TextAlignment: Story = {
    render: () => (
        <div className="space-y-4">
            <p className="text-left">This text is left aligned.</p>
            <p className="text-center">This text is center aligned.</p>
            <p className="text-right">This text is right aligned.</p>
            <p className="text-justify">
                This text is justified. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
                do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
                veniam, quis nostrud exercitation ullamco laboris.
            </p>
        </div>
    )
};

export const TextDecorations: Story = {
    render: () => (
        <div className="space-y-2">
            <p className="underline">Underlined text</p>
            <p className="line-through">Strikethrough text</p>
            <p className="no-underline">No underline text</p>
            <p>
                <a
                    href="#"
                    className="text-primary underline underline-offset-4 hover:no-underline"
                >
                    Link with underline offset
                </a>
            </p>
        </div>
    )
};

export const TextTransform: Story = {
    render: () => (
        <div className="space-y-2">
            <p className="uppercase">Uppercase text</p>
            <p className="lowercase">Lowercase text</p>
            <p className="capitalize">capitalize each word</p>
            <p className="normal-case">Normal case text</p>
        </div>
    )
};

export const Lists: Story = {
    render: () => (
        <div className="grid max-w-2xl grid-cols-2 gap-8">
            <div>
                <h4 className="mb-2 font-semibold">Unordered List</h4>
                <ul className="ml-6 list-disc space-y-2 text-sm">
                    <li>First item</li>
                    <li>Second item</li>
                    <li>Third item</li>
                    <li>
                        Nested item
                        <ul className="list-circle mt-2 ml-6 space-y-1">
                            <li>Nested first</li>
                            <li>Nested second</li>
                        </ul>
                    </li>
                </ul>
            </div>
            <div>
                <h4 className="mb-2 font-semibold">Ordered List</h4>
                <ol className="ml-6 list-decimal space-y-2 text-sm">
                    <li>First step</li>
                    <li>Second step</li>
                    <li>Third step</li>
                    <li>
                        Fourth step
                        <ol className="mt-2 ml-6 list-[lower-alpha] space-y-1">
                            <li>Sub-step A</li>
                            <li>Sub-step B</li>
                        </ol>
                    </li>
                </ol>
            </div>
        </div>
    )
};

export const Blockquote: Story = {
    render: () => (
        <div className="max-w-2xl space-y-4">
            <blockquote className="border-primary border-l-2 pl-4 italic">
                "This is a blockquote with a left border. It's used for quotations or highlighting
                important information."
            </blockquote>
            <blockquote className="bg-muted rounded-lg p-4 text-sm">
                <p className="mb-2">
                    "This is a blockquote with background styling. Lorem ipsum dolor sit amet,
                    consectetur adipiscing elit."
                </p>
                <footer className="text-muted-foreground text-xs">— Author Name</footer>
            </blockquote>
        </div>
    )
};

export const Code: Story = {
    render: () => (
        <div className="max-w-2xl space-y-4">
            <div>
                <p className="mb-2 text-sm">Inline code:</p>
                <p className="text-sm">
                    Use the{" "}
                    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                        useState
                    </code>{" "}
                    hook to manage state in React.
                </p>
            </div>
            <div>
                <p className="mb-2 text-sm">Code block:</p>
                <pre className="bg-muted overflow-x-auto rounded-lg p-4">
                    <code className="font-mono text-xs">{`function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return true;
}`}</code>
                </pre>
            </div>
        </div>
    )
};

export const Emphasis: Story = {
    render: () => (
        <div className="space-y-2">
            <p>
                This is <strong>bold text</strong> using the strong tag.
            </p>
            <p>
                This is <em>italic text</em> using the em tag.
            </p>
            <p>
                This is <span className="font-semibold">semibold text</span> using a class.
            </p>
            <p>
                This is <mark className="bg-yellow-200 dark:bg-yellow-900">highlighted text</mark>.
            </p>
            <p>
                This is <small className="text-xs">small text</small> using the small tag.
            </p>
        </div>
    )
};

export const TruncatedText: Story = {
    render: () => (
        <div className="max-w-md space-y-4">
            <div>
                <p className="mb-2 text-sm font-medium">Single line truncate</p>
                <p className="truncate text-sm">
                    This is a very long text that will be truncated with an ellipsis when it
                    overflows the container width and cannot fit in a single line.
                </p>
            </div>
            <div>
                <p className="mb-2 text-sm font-medium">Two line clamp</p>
                <p className="line-clamp-2 text-sm">
                    This is a longer text that will be truncated after two lines. Lorem ipsum dolor
                    sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
                    labore et dolore magna aliqua. Ut enim ad minim veniam.
                </p>
            </div>
            <div>
                <p className="mb-2 text-sm font-medium">Three line clamp</p>
                <p className="line-clamp-3 text-sm">
                    This is an even longer text that will be truncated after three lines. Lorem
                    ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                    incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                    nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                </p>
            </div>
        </div>
    )
};

export const AllTypography: Story = {
    render: () => (
        <div className="max-w-4xl space-y-8">
            <section>
                <h2 className="mb-4 text-2xl font-bold">Headings</h2>
                <div className="space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight">Heading 1</h1>
                    <h2 className="text-3xl font-semibold tracking-tight">Heading 2</h2>
                    <h3 className="text-2xl font-semibold tracking-tight">Heading 3</h3>
                    <h4 className="text-xl font-semibold tracking-tight">Heading 4</h4>
                    <h5 className="text-lg font-semibold tracking-tight">Heading 5</h5>
                    <h6 className="text-base font-semibold tracking-tight">Heading 6</h6>
                </div>
            </section>

            <section>
                <h2 className="mb-4 text-2xl font-bold">Body Text</h2>
                <p className="mb-4 text-base">
                    This is a paragraph of body text. Lorem ipsum dolor sit amet, consectetur
                    adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna
                    aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi
                    ut aliquip ex ea commodo consequat.
                </p>
                <p className="text-muted-foreground text-sm">
                    This is muted secondary text, often used for descriptions or less important
                    information.
                </p>
            </section>

            <section>
                <h2 className="mb-4 text-2xl font-bold">Lists</h2>
                <div className="grid grid-cols-2 gap-6">
                    <ul className="ml-6 list-disc space-y-2 text-sm">
                        <li>Unordered list item</li>
                        <li>Another item</li>
                        <li>Third item</li>
                    </ul>
                    <ol className="ml-6 list-decimal space-y-2 text-sm">
                        <li>Ordered list item</li>
                        <li>Second item</li>
                        <li>Third item</li>
                    </ol>
                </div>
            </section>

            <section>
                <h2 className="mb-4 text-2xl font-bold">Inline Elements</h2>
                <p className="text-sm">
                    This paragraph contains <strong>bold text</strong>, <em>italic text</em>, and{" "}
                    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                        inline code
                    </code>
                    . You can also use{" "}
                    <a href="#" className="text-primary underline underline-offset-4">
                        hyperlinks
                    </a>{" "}
                    and <mark className="bg-yellow-200 dark:bg-yellow-900">highlighted text</mark>.
                </p>
            </section>

            <section>
                <h2 className="mb-4 text-2xl font-bold">Blockquote</h2>
                <blockquote className="border-primary border-l-2 pl-4 italic">
                    "Design is not just what it looks like and feels like. Design is how it works."
                    <footer className="text-muted-foreground mt-2 text-sm not-italic">
                        — Steve Jobs
                    </footer>
                </blockquote>
            </section>
        </div>
    )
};
