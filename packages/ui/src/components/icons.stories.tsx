import type { Meta, StoryObj } from "@storybook/react";
import { Icon, icons, HugeiconsIcon } from "../icons";

// Icon size constant - change this to adjust all icon sizes
const ICON_SIZE = "size-12";

const meta = {
    title: "Foundation/Icons",
    parameters: {
        layout: "padded"
    },
    tags: ["autodocs"]
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Helper component to display an icon with its name
const IconItem = ({ icon, name }: { icon: any; name: string }) => (
    <div className="border-border hover:bg-muted/50 flex flex-col items-center gap-2 rounded-lg border p-4">
        <HugeiconsIcon icon={icon} className={ICON_SIZE} />
        <span className="text-muted-foreground text-center font-mono text-xs">{name}</span>
    </div>
);

// Helper component for icon sections
const IconSection = ({
    title,
    iconList
}: {
    title: string;
    iconList: Array<{ key: string; name: string }>;
}) => (
    <div className="space-y-4">
        <h3 className="text-foreground text-lg font-semibold">{title}</h3>
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {iconList.map(({ key, name }) => (
                <IconItem key={key} icon={icons[key as keyof typeof icons]} name={name} />
            ))}
        </div>
    </div>
);

export const CommonIcons: Story = {
    render: () => (
        <div className="space-y-8">
            <div>
                <h1 className="text-foreground mb-2 text-2xl font-bold">Icon System</h1>
                <p className="text-muted-foreground text-sm">
                    Centralized icon wrapper that makes it easy to swap icon libraries. All icons
                    are {ICON_SIZE} in size. Use semantic names for maintainability.
                </p>
            </div>

            <IconSection
                title="Navigation & Core UI"
                iconList={[
                    { key: "home", name: "home" },
                    { key: "dashboard", name: "dashboard" },
                    { key: "settings", name: "settings" },
                    { key: "chevron-down", name: "chevron-down" },
                    { key: "search", name: "search" },
                    { key: "sidebar-left", name: "sidebar-left" },
                    { key: "more-horizontal", name: "more-horizontal" }
                ]}
            />

            <IconSection
                title="Files & Organization"
                iconList={[
                    { key: "file", name: "file" },
                    { key: "folder", name: "folder" },
                    { key: "folder-open", name: "folder-open" }
                ]}
            />

            <IconSection title="Communication" iconList={[{ key: "messages", name: "messages" }]} />

            <IconSection
                title="User & Account"
                iconList={[
                    { key: "user", name: "user" },
                    { key: "logout", name: "logout" }
                ]}
            />

            <IconSection
                title="Time & Calendar"
                iconList={[
                    { key: "calendar", name: "calendar" },
                    { key: "clock", name: "clock" }
                ]}
            />

            <IconSection
                title="Commerce & Shopping"
                iconList={[{ key: "shopping-cart", name: "shopping-cart" }]}
            />

            <IconSection
                title="Security & Status"
                iconList={[
                    { key: "lock", name: "lock" },
                    { key: "star", name: "star" }
                ]}
            />

            <IconSection
                title="AI & Technology"
                iconList={[{ key: "ai-network", name: "ai-network" }]}
            />

            <IconSection
                title="Arrows"
                iconList={[
                    { key: "arrow-left", name: "arrow-left" },
                    { key: "arrow-right", name: "arrow-right" }
                ]}
            />

            <IconSection
                title="Alerts & Feedback"
                iconList={[
                    { key: "alert-triangle", name: "alert-triangle" },
                    { key: "alert-diamond", name: "alert-diamond" },
                    { key: "info-circle", name: "info-circle" },
                    { key: "checkmark-circle", name: "checkmark-circle" },
                    { key: "tick", name: "tick" },
                    { key: "cancel", name: "cancel" },
                    { key: "delete", name: "delete" },
                    { key: "refresh", name: "refresh" }
                ]}
            />

            <div className="bg-muted/30 rounded-lg p-6">
                <h3 className="text-foreground mb-2 text-sm font-semibold">Usage Patterns</h3>
                <div className="space-y-4">
                    <div>
                        <p className="text-muted-foreground mb-2 text-xs font-semibold">
                            Semantic Usage (Recommended for Components)
                        </p>
                        <code className="bg-background text-foreground block rounded p-2 text-xs">
                            import &#123; Icon &#125; from &quot;@repo/ui&quot;;
                            <br />
                            <br />
                            &lt;Icon name=&quot;home&quot; className=&quot;{ICON_SIZE}&quot; /&gt;
                            <br />
                            &lt;Icon name=&quot;settings&quot; className=&quot;size-6&quot; /&gt;
                        </code>
                    </div>
                    <div>
                        <p className="text-muted-foreground mb-2 text-xs font-semibold">
                            Reference Usage (For Config Files)
                        </p>
                        <code className="bg-background text-foreground block rounded p-2 text-xs">
                            import &#123; icons &#125; from &quot;@repo/ui&quot;;
                            <br />
                            <br />
                            const navigationConfig = &#123;
                            <br />
                            &nbsp;&nbsp;icon: icons.home, // Component reference, not JSX
                            <br />
                            &nbsp;&nbsp;label: &quot;Home&quot;
                            <br />
                            &#125;;
                        </code>
                    </div>
                    <div>
                        <p className="text-muted-foreground mb-2 text-xs font-semibold">
                            Legacy HugeIcons Usage (Backward Compatibility)
                        </p>
                        <code className="bg-background text-foreground block rounded p-2 text-xs">
                            import &#123; icons, HugeiconsIcon &#125; from &quot;@repo/ui&quot;;
                            <br />
                            <br />
                            &lt;HugeiconsIcon icon=&#123;icons.search&#125;
                            className=&quot;size-5&quot; /&gt;
                        </code>
                    </div>
                </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-6">
                <h3 className="text-foreground mb-2 text-sm font-semibold">
                    Swapping Icon Libraries
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                    The icon system is designed to make library swaps easy. To change from HugeIcons
                    to another library (e.g., Lucide):
                </p>
                <ol className="text-muted-foreground mt-2 list-inside list-decimal space-y-1 text-xs">
                    <li>Update imports in packages/ui/src/icons/icon-map.ts</li>
                    <li>Replace wrapper component in packages/ui/src/icons/index.tsx</li>
                    <li>Update dependencies in packages/ui/package.json</li>
                    <li>All consuming code continues to work unchanged</li>
                </ol>
            </div>
        </div>
    )
};

export const IconSizes: Story = {
    render: () => (
        <div className="space-y-8">
            <div>
                <h1 className="text-foreground mb-2 text-2xl font-bold">Icon Sizes</h1>
                <p className="text-muted-foreground text-sm">
                    Icons can be sized using Tailwind size utilities. Current default: {ICON_SIZE}
                </p>
            </div>

            <div className="space-y-6">
                {[
                    { size: "size-4", label: "size-4 (16px)" },
                    { size: "size-6", label: "size-6 (24px)" },
                    { size: "size-8", label: "size-8 (32px)" },
                    { size: "size-10", label: "size-10 (40px)" },
                    { size: "size-12", label: "size-12 (48px) - Default" },
                    { size: "size-16", label: "size-16 (64px)" },
                    { size: "size-20", label: "size-20 (80px)" },
                    { size: "size-24", label: "size-24 (96px)" }
                ].map(({ size, label }) => (
                    <div key={size} className="flex items-center gap-4">
                        <div className="w-48">
                            <span className="text-muted-foreground font-mono text-sm">{label}</span>
                        </div>
                        <Icon name="settings" className={size} />
                        <Icon name="home" className={size} />
                        <Icon name="user" className={size} />
                    </div>
                ))}
            </div>
        </div>
    )
};

export const IconColors: Story = {
    render: () => (
        <div className="space-y-8">
            <div>
                <h1 className="text-foreground mb-2 text-2xl font-bold">Icon Colors</h1>
                <p className="text-muted-foreground text-sm">
                    Icons inherit text color and can be themed using Tailwind color utilities.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
                <div className="flex flex-col items-center gap-2">
                    <Icon name="home" className={`${ICON_SIZE} text-foreground`} />
                    <span className="text-muted-foreground text-xs">Foreground</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Icon name="home" className={`${ICON_SIZE} text-muted-foreground`} />
                    <span className="text-muted-foreground text-xs">Muted</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Icon name="home" className={`${ICON_SIZE} text-primary`} />
                    <span className="text-muted-foreground text-xs">Primary</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Icon name="home" className={`${ICON_SIZE} text-destructive`} />
                    <span className="text-muted-foreground text-xs">Destructive</span>
                </div>
            </div>
        </div>
    )
};
