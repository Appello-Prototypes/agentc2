"use client";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "./dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { userMenuItems } from "../config/user-menu";
import { useState } from "react";

type UserMenuProps = {
    trigger: React.ReactNode;
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
    onSignOut: () => void;
};

export function UserMenu({ trigger, align = "end", side, sideOffset, onSignOut }: UserMenuProps) {
    const [settingsOpen, setSettingsOpen] = useState(false);

    const handleMenuAction = (action: string) => {
        switch (action) {
            case "settings":
                setSettingsOpen(true);
                break;
            case "signout":
                onSignOut();
                break;
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger className="outline-none">{trigger}</DropdownMenuTrigger>
                <DropdownMenuContent
                    align={align}
                    side={side}
                    sideOffset={sideOffset}
                    className="w-56"
                >
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

            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Settings</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-muted-foreground text-sm">
                            Settings functionality coming soon...
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
