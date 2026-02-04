"use client";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "./dropdown-menu";
import { userMenuItems } from "../config/user-menu";

type UserMenuProps = {
    trigger: React.ReactNode;
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
    onSignOut: () => void;
    onSettings?: () => void;
};

export function UserMenu({
    trigger,
    align = "end",
    side,
    sideOffset,
    onSignOut,
    onSettings
}: UserMenuProps) {
    const handleMenuAction = (action: string) => {
        switch (action) {
            case "settings":
                if (onSettings) {
                    onSettings();
                } else {
                    // Default fallback: navigate to settings
                    window.location.href = "/settings";
                }
                break;
            case "signout":
                onSignOut();
                break;
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">{trigger}</DropdownMenuTrigger>
            <DropdownMenuContent align={align} side={side} sideOffset={sideOffset} className="w-56">
                {userMenuItems.map((menuItem, index) => (
                    <div key={menuItem.action}>
                        {index > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                            variant={menuItem.variant}
                            onClick={() => handleMenuAction(menuItem.action)}
                        >
                            {menuItem.label}
                        </DropdownMenuItem>
                    </div>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
