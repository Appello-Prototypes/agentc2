"use client";

import Nav from "./_nav";
import { usePathname } from "next/navigation";

export default function ClientNav({ id }: { id: string }) {
    const pathname = usePathname();

    return <Nav id={id} currentPath={pathname} />;
}
