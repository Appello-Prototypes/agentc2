export type UserMenuItem = {
    label: string;
    action: "settings" | "signout";
    variant?: "default" | "destructive";
};

export const userMenuItems: UserMenuItem[] = [
    {
        label: "settings",
        action: "settings",
        variant: "destructive"
    },
    {
        label: "Sign out",
        action: "signout",
        variant: "destructive"
    }
];
