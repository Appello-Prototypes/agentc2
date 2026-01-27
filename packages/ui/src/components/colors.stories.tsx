import type { Meta, StoryObj } from "@storybook/react";

const meta = {
    title: "Foundation/Colors",
    parameters: {
        layout: "padded"
    },
    tags: ["autodocs"]
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const ColorSwatch = ({
    name,
    className,
    description
}: {
    name: string;
    className: string;
    description?: string;
}) => (
    <div className="flex flex-col gap-2">
        <div className={`h-20 w-full rounded-lg border ${className}`} />
        <div>
            <p className="text-sm font-medium">{name}</p>
            {description && <p className="text-muted-foreground text-xs">{description}</p>}
        </div>
    </div>
);

export const ThemeColors: Story = {
    render: () => (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            <ColorSwatch
                name="Background"
                className="bg-background"
                description="Main background color"
            />
            <ColorSwatch
                name="Foreground"
                className="bg-foreground"
                description="Main text color"
            />
            <ColorSwatch name="Card" className="bg-card" description="Card background" />
            <ColorSwatch
                name="Card Foreground"
                className="bg-card-foreground"
                description="Card text color"
            />
            <ColorSwatch name="Popover" className="bg-popover" description="Popover background" />
            <ColorSwatch
                name="Popover Foreground"
                className="bg-popover-foreground"
                description="Popover text"
            />
            <ColorSwatch name="Primary" className="bg-primary" description="Primary brand color" />
            <ColorSwatch
                name="Primary Foreground"
                className="bg-primary-foreground"
                description="Text on primary"
            />
            <ColorSwatch name="Secondary" className="bg-secondary" description="Secondary color" />
            <ColorSwatch
                name="Secondary Foreground"
                className="bg-secondary-foreground"
                description="Text on secondary"
            />
            <ColorSwatch name="Muted" className="bg-muted" description="Muted backgrounds" />
            <ColorSwatch
                name="Muted Foreground"
                className="bg-muted-foreground"
                description="Muted text"
            />
            <ColorSwatch name="Accent" className="bg-accent" description="Accent color" />
            <ColorSwatch
                name="Accent Foreground"
                className="bg-accent-foreground"
                description="Text on accent"
            />
            <ColorSwatch
                name="Destructive"
                className="bg-destructive"
                description="Error/danger color"
            />
            <ColorSwatch
                name="Destructive Foreground"
                className="bg-destructive-foreground"
                description="Text on destructive"
            />
        </div>
    )
};

export const BorderColors: Story = {
    render: () => (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-2">
                <div className="bg-background border-border h-20 w-full rounded-lg border-2" />
                <div>
                    <p className="text-sm font-medium">Border</p>
                    <p className="text-muted-foreground text-xs">Default border color</p>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <div className="bg-background border-input h-20 w-full rounded-lg border-2" />
                <div>
                    <p className="text-sm font-medium">Input</p>
                    <p className="text-muted-foreground text-xs">Input border color</p>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <div className="bg-background border-ring h-20 w-full rounded-lg border-2" />
                <div>
                    <p className="text-sm font-medium">Ring</p>
                    <p className="text-muted-foreground text-xs">Focus ring color</p>
                </div>
            </div>
        </div>
    )
};

export const SemanticColors: Story = {
    render: () => (
        <div className="space-y-8">
            <div>
                <h3 className="mb-4 text-lg font-semibold">Success Colors</h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <ColorSwatch name="Green 100" className="bg-green-100 dark:bg-green-950" />
                    <ColorSwatch name="Green 200" className="bg-green-200 dark:bg-green-900" />
                    <ColorSwatch name="Green 500" className="bg-green-500" />
                    <ColorSwatch name="Green 600" className="bg-green-600" />
                </div>
            </div>

            <div>
                <h3 className="mb-4 text-lg font-semibold">Warning Colors</h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <ColorSwatch name="Yellow 100" className="bg-yellow-100 dark:bg-yellow-950" />
                    <ColorSwatch name="Yellow 200" className="bg-yellow-200 dark:bg-yellow-900" />
                    <ColorSwatch name="Orange 500" className="bg-orange-500" />
                    <ColorSwatch name="Orange 600" className="bg-orange-600" />
                </div>
            </div>

            <div>
                <h3 className="mb-4 text-lg font-semibold">Error Colors</h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <ColorSwatch name="Red 100" className="bg-red-100 dark:bg-red-950" />
                    <ColorSwatch name="Red 200" className="bg-red-200 dark:bg-red-900" />
                    <ColorSwatch name="Red 500" className="bg-red-500" />
                    <ColorSwatch name="Red 600" className="bg-red-600" />
                </div>
            </div>

            <div>
                <h3 className="mb-4 text-lg font-semibold">Info Colors</h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <ColorSwatch name="Blue 100" className="bg-blue-100 dark:bg-blue-950" />
                    <ColorSwatch name="Blue 200" className="bg-blue-200 dark:bg-blue-900" />
                    <ColorSwatch name="Blue 500" className="bg-blue-500" />
                    <ColorSwatch name="Blue 600" className="bg-blue-600" />
                </div>
            </div>
        </div>
    )
};

export const GrayScale: Story = {
    render: () => (
        <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
            <ColorSwatch name="Gray 50" className="bg-gray-50 dark:bg-gray-950" />
            <ColorSwatch name="Gray 100" className="bg-gray-100 dark:bg-gray-900" />
            <ColorSwatch name="Gray 200" className="bg-gray-200 dark:bg-gray-800" />
            <ColorSwatch name="Gray 300" className="bg-gray-300 dark:bg-gray-700" />
            <ColorSwatch name="Gray 400" className="bg-gray-400 dark:bg-gray-600" />
            <ColorSwatch name="Gray 500" className="bg-gray-500" />
            <ColorSwatch name="Gray 600" className="bg-gray-600 dark:bg-gray-400" />
            <ColorSwatch name="Gray 700" className="bg-gray-700 dark:bg-gray-300" />
            <ColorSwatch name="Gray 800" className="bg-gray-800 dark:bg-gray-200" />
            <ColorSwatch name="Gray 900" className="bg-gray-900 dark:bg-gray-100" />
            <ColorSwatch name="Gray 950" className="bg-gray-950 dark:bg-gray-50" />
            <ColorSwatch name="Black" className="bg-black" />
        </div>
    )
};

export const ZincScale: Story = {
    render: () => (
        <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
            <ColorSwatch name="Zinc 50" className="bg-zinc-50 dark:bg-zinc-950" />
            <ColorSwatch name="Zinc 100" className="bg-zinc-100 dark:bg-zinc-900" />
            <ColorSwatch name="Zinc 200" className="bg-zinc-200 dark:bg-zinc-800" />
            <ColorSwatch name="Zinc 300" className="bg-zinc-300 dark:bg-zinc-700" />
            <ColorSwatch name="Zinc 400" className="bg-zinc-400 dark:bg-zinc-600" />
            <ColorSwatch name="Zinc 500" className="bg-zinc-500" />
            <ColorSwatch name="Zinc 600" className="bg-zinc-600 dark:bg-zinc-400" />
            <ColorSwatch name="Zinc 700" className="bg-zinc-700 dark:bg-zinc-300" />
            <ColorSwatch name="Zinc 800" className="bg-zinc-800 dark:bg-zinc-200" />
            <ColorSwatch name="Zinc 900" className="bg-zinc-900 dark:bg-zinc-100" />
            <ColorSwatch name="Zinc 950" className="bg-zinc-950 dark:bg-zinc-50" />
        </div>
    )
};

export const TextColors: Story = {
    render: () => (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="w-48">
                    <p className="text-sm font-medium">Foreground</p>
                </div>
                <p className="text-foreground">The quick brown fox jumps over the lazy dog</p>
            </div>
            <div className="flex items-center gap-4">
                <div className="w-48">
                    <p className="text-sm font-medium">Muted Foreground</p>
                </div>
                <p className="text-muted-foreground">The quick brown fox jumps over the lazy dog</p>
            </div>
            <div className="flex items-center gap-4">
                <div className="w-48">
                    <p className="text-sm font-medium">Primary</p>
                </div>
                <p className="text-primary">The quick brown fox jumps over the lazy dog</p>
            </div>
            <div className="flex items-center gap-4">
                <div className="w-48">
                    <p className="text-sm font-medium">Secondary Foreground</p>
                </div>
                <p className="text-secondary-foreground">
                    The quick brown fox jumps over the lazy dog
                </p>
            </div>
            <div className="flex items-center gap-4">
                <div className="w-48">
                    <p className="text-sm font-medium">Accent Foreground</p>
                </div>
                <p className="text-accent-foreground">
                    The quick brown fox jumps over the lazy dog
                </p>
            </div>
            <div className="flex items-center gap-4">
                <div className="w-48">
                    <p className="text-sm font-medium">Destructive</p>
                </div>
                <p className="text-destructive">The quick brown fox jumps over the lazy dog</p>
            </div>
        </div>
    )
};

export const BackgroundColors: Story = {
    render: () => (
        <div className="space-y-4">
            <div className="bg-background rounded-lg border p-4">
                <p className="text-sm font-medium">Background</p>
                <p className="text-muted-foreground text-xs">Main app background</p>
            </div>
            <div className="bg-card rounded-lg border p-4">
                <p className="text-sm font-medium">Card</p>
                <p className="text-muted-foreground text-xs">Card background</p>
            </div>
            <div className="bg-popover rounded-lg border p-4">
                <p className="text-sm font-medium">Popover</p>
                <p className="text-muted-foreground text-xs">Dropdown/popover background</p>
            </div>
            <div className="bg-muted rounded-lg p-4">
                <p className="text-sm font-medium">Muted</p>
                <p className="text-muted-foreground text-xs">Subtle background</p>
            </div>
            <div className="bg-accent rounded-lg p-4">
                <p className="text-sm font-medium">Accent</p>
                <p className="text-muted-foreground text-xs">Hover/active states</p>
            </div>
            <div className="bg-primary rounded-lg p-4">
                <p className="text-primary-foreground text-sm font-medium">Primary</p>
                <p className="text-primary-foreground text-xs opacity-80">Primary actions</p>
            </div>
            <div className="bg-secondary rounded-lg p-4">
                <p className="text-secondary-foreground text-sm font-medium">Secondary</p>
                <p className="text-secondary-foreground text-xs opacity-80">Secondary actions</p>
            </div>
            <div className="bg-destructive rounded-lg p-4">
                <p className="text-destructive-foreground text-sm font-medium">Destructive</p>
                <p className="text-destructive-foreground text-xs opacity-80">Dangerous actions</p>
            </div>
        </div>
    )
};

export const Opacity: Story = {
    render: () => (
        <div className="space-y-8">
            <div>
                <h3 className="mb-4 text-lg font-semibold">Background Opacity</h3>
                <div className="bg-primary relative h-32 rounded-lg">
                    <div className="bg-background/10 absolute inset-x-4 top-2 h-6 rounded" />
                    <div className="bg-background/25 absolute inset-x-4 top-10 h-6 rounded" />
                    <div className="bg-background/50 absolute inset-x-4 top-[4.5rem] h-6 rounded" />
                    <div className="bg-background/75 absolute inset-x-4 top-24 h-6 rounded" />
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                    <span>10%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                </div>
            </div>

            <div>
                <h3 className="mb-4 text-lg font-semibold">Text Opacity</h3>
                <div className="space-y-2">
                    <p className="opacity-100">Opacity 100% - Full visibility</p>
                    <p className="opacity-90">Opacity 90%</p>
                    <p className="opacity-75">Opacity 75%</p>
                    <p className="opacity-50">Opacity 50%</p>
                    <p className="opacity-25">Opacity 25%</p>
                    <p className="opacity-10">Opacity 10%</p>
                </div>
            </div>
        </div>
    )
};

export const ColorUtilities: Story = {
    render: () => (
        <div className="space-y-8">
            <div>
                <h3 className="mb-4 text-lg font-semibold">Ring Colors (Focus States)</h3>
                <div className="flex flex-wrap gap-4">
                    <input
                        type="text"
                        placeholder="Default ring"
                        className="focus:ring-ring rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                    />
                    <input
                        type="text"
                        placeholder="Primary ring"
                        className="focus:ring-primary rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                    />
                    <input
                        type="text"
                        placeholder="Destructive ring"
                        className="focus:ring-destructive rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                    />
                </div>
            </div>

            <div>
                <h3 className="mb-4 text-lg font-semibold">Border Styles</h3>
                <div className="space-y-2">
                    <div className="border-border rounded-lg border p-3">
                        <p className="text-sm">Default border</p>
                    </div>
                    <div className="border-primary rounded-lg border-2 p-3">
                        <p className="text-sm">Primary border (2px)</p>
                    </div>
                    <div className="border-muted-foreground rounded-lg border-4 p-3">
                        <p className="text-sm">Muted border (4px)</p>
                    </div>
                    <div className="border-destructive rounded-lg border-l-4 p-3">
                        <p className="text-sm">Left border accent</p>
                    </div>
                </div>
            </div>
        </div>
    )
};

export const AllColors: Story = {
    render: () => (
        <div className="space-y-12">
            <section>
                <h2 className="mb-6 text-2xl font-bold">Theme Colors</h2>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <ColorSwatch name="Primary" className="bg-primary" />
                    <ColorSwatch name="Secondary" className="bg-secondary" />
                    <ColorSwatch name="Accent" className="bg-accent" />
                    <ColorSwatch name="Destructive" className="bg-destructive" />
                    <ColorSwatch name="Muted" className="bg-muted" />
                    <ColorSwatch name="Border" className="bg-border" />
                    <ColorSwatch name="Input" className="bg-input" />
                    <ColorSwatch name="Ring" className="bg-ring" />
                </div>
            </section>

            <section>
                <h2 className="mb-6 text-2xl font-bold">Semantic Colors</h2>
                <div className="space-y-6">
                    <div>
                        <h3 className="mb-3 text-sm font-semibold text-green-600">Success</h3>
                        <div className="grid grid-cols-4 gap-2">
                            <ColorSwatch name="Light" className="bg-green-100 dark:bg-green-950" />
                            <ColorSwatch name="Base" className="bg-green-500" />
                            <ColorSwatch name="Dark" className="bg-green-600" />
                            <ColorSwatch name="Text" className="bg-green-700" />
                        </div>
                    </div>
                    <div>
                        <h3 className="mb-3 text-sm font-semibold text-orange-600">Warning</h3>
                        <div className="grid grid-cols-4 gap-2">
                            <ColorSwatch
                                name="Light"
                                className="bg-yellow-100 dark:bg-yellow-950"
                            />
                            <ColorSwatch name="Base" className="bg-orange-500" />
                            <ColorSwatch name="Dark" className="bg-orange-600" />
                            <ColorSwatch name="Text" className="bg-orange-700" />
                        </div>
                    </div>
                    <div>
                        <h3 className="mb-3 text-sm font-semibold text-red-600">Error</h3>
                        <div className="grid grid-cols-4 gap-2">
                            <ColorSwatch name="Light" className="bg-red-100 dark:bg-red-950" />
                            <ColorSwatch name="Base" className="bg-red-500" />
                            <ColorSwatch name="Dark" className="bg-red-600" />
                            <ColorSwatch name="Text" className="bg-red-700" />
                        </div>
                    </div>
                    <div>
                        <h3 className="mb-3 text-sm font-semibold text-blue-600">Info</h3>
                        <div className="grid grid-cols-4 gap-2">
                            <ColorSwatch name="Light" className="bg-blue-100 dark:bg-blue-950" />
                            <ColorSwatch name="Base" className="bg-blue-500" />
                            <ColorSwatch name="Dark" className="bg-blue-600" />
                            <ColorSwatch name="Text" className="bg-blue-700" />
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <h2 className="mb-6 text-2xl font-bold">Gray Scale (Zinc)</h2>
                <div className="grid grid-cols-6 gap-2">
                    <ColorSwatch name="50" className="bg-zinc-50 dark:bg-zinc-950" />
                    <ColorSwatch name="100" className="bg-zinc-100 dark:bg-zinc-900" />
                    <ColorSwatch name="200" className="bg-zinc-200 dark:bg-zinc-800" />
                    <ColorSwatch name="300" className="bg-zinc-300 dark:bg-zinc-700" />
                    <ColorSwatch name="400" className="bg-zinc-400 dark:bg-zinc-600" />
                    <ColorSwatch name="500" className="bg-zinc-500" />
                    <ColorSwatch name="600" className="bg-zinc-600 dark:bg-zinc-400" />
                    <ColorSwatch name="700" className="bg-zinc-700 dark:bg-zinc-300" />
                    <ColorSwatch name="800" className="bg-zinc-800 dark:bg-zinc-200" />
                    <ColorSwatch name="900" className="bg-zinc-900 dark:bg-zinc-100" />
                    <ColorSwatch name="950" className="bg-zinc-950 dark:bg-zinc-50" />
                </div>
            </section>
        </div>
    )
};
