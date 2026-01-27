import type { Meta, StoryObj } from "@storybook/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    // Core icons verified to exist
    HomeIcon,
    DashboardSpeed01Icon,
    Settings02Icon,
    FolderOpenIcon,
    ShoppingCart01Icon,
    AiNetworkIcon,
    UserIcon,
    FileIcon,
    FolderIcon,
    CalendarIcon,
    ClockIcon,
    LockIcon,
    StarIcon,
    Logout03Icon,
    MessageMultiple01Icon,
    ChevronDown
} from "@hugeicons/core-free-icons";

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
    icons
}: {
    title: string;
    icons: Array<{ icon: any; name: string }>;
}) => (
    <div className="space-y-4">
        <h3 className="text-foreground text-lg font-semibold">{title}</h3>
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {icons.map(({ icon, name }) => (
                <IconItem key={name} icon={icon} name={name} />
            ))}
        </div>
    </div>
);

export const CommonIcons: Story = {
    render: () => (
        <div className="space-y-8">
            <div>
                <h1 className="text-foreground mb-2 text-2xl font-bold">
                    HugeIcons Free Collection
                </h1>
                <p className="text-muted-foreground text-sm">
                    Commonly used icons from HugeIcons. All icons are {ICON_SIZE} in size. This is a
                    curated subset - the free collection includes 4,600+ icons.
                </p>
            </div>

            <IconSection
                title="Navigation & Core UI"
                icons={[
                    { icon: HomeIcon, name: "Home" },
                    { icon: DashboardSpeed01Icon, name: "Dashboard" },
                    { icon: Settings02Icon, name: "Settings" },
                    { icon: ChevronDown, name: "Chevron" }
                ]}
            />

            <IconSection
                title="Files & Organization"
                icons={[
                    { icon: FileIcon, name: "File" },
                    { icon: FolderIcon, name: "Folder" },
                    { icon: FolderOpenIcon, name: "Folder Open" }
                ]}
            />

            <IconSection
                title="Communication"
                icons={[{ icon: MessageMultiple01Icon, name: "Messages" }]}
            />

            <IconSection
                title="User & Account"
                icons={[
                    { icon: UserIcon, name: "User" },
                    { icon: Logout03Icon, name: "Logout" }
                ]}
            />

            <IconSection
                title="Time & Calendar"
                icons={[
                    { icon: CalendarIcon, name: "Calendar" },
                    { icon: ClockIcon, name: "Clock" }
                ]}
            />

            <IconSection
                title="Commerce & Shopping"
                icons={[{ icon: ShoppingCart01Icon, name: "Shopping Cart" }]}
            />

            <IconSection
                title="Security & Status"
                icons={[
                    { icon: LockIcon, name: "Lock" },
                    { icon: StarIcon, name: "Star" }
                ]}
            />

            <IconSection
                title="AI & Technology"
                icons={[{ icon: AiNetworkIcon, name: "AI Network" }]}
            />

            <div className="bg-muted/30 rounded-lg p-6">
                <h3 className="text-foreground mb-2 text-sm font-semibold">
                    About HugeIcons Free Collection
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                    The HugeIcons free collection contains over 4,600 icons. This showcase displays
                    a curated subset of commonly used icons in this project. To use additional
                    icons, import them from{" "}
                    <code className="bg-muted text-foreground rounded px-1 py-0.5">
                        @hugeicons/core-free-icons
                    </code>{" "}
                    and render with{" "}
                    <code className="bg-muted text-foreground rounded px-1 py-0.5">
                        HugeiconsIcon
                    </code>
                    .
                </p>
                <div className="mt-3">
                    <code className="bg-background text-foreground text-muted-foreground block rounded p-2 text-xs">
                        import &#123; IconName &#125; from &quot;@hugeicons/core-free-icons&quot;;
                        <br />
                        import &#123; HugeiconsIcon &#125; from &quot;@hugeicons/react&quot;;
                        <br />
                        <br />
                        &lt;HugeiconsIcon icon=&#123;IconName&#125; className=&quot;
                        {ICON_SIZE}&quot; /&gt;
                    </code>
                </div>
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
                        <HugeiconsIcon icon={Settings02Icon} className={size} />
                        <HugeiconsIcon icon={HomeIcon} className={size} />
                        <HugeiconsIcon icon={UserIcon} className={size} />
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
                    <HugeiconsIcon icon={HomeIcon} className={`${ICON_SIZE} text-foreground`} />
                    <span className="text-muted-foreground text-xs">Foreground</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <HugeiconsIcon
                        icon={HomeIcon}
                        className={`${ICON_SIZE} text-muted-foreground`}
                    />
                    <span className="text-muted-foreground text-xs">Muted</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <HugeiconsIcon icon={HomeIcon} className={`${ICON_SIZE} text-primary`} />
                    <span className="text-muted-foreground text-xs">Primary</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <HugeiconsIcon icon={HomeIcon} className={`${ICON_SIZE} text-destructive`} />
                    <span className="text-muted-foreground text-xs">Destructive</span>
                </div>
            </div>
        </div>
    )
};
