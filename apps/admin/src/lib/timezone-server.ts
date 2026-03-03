import { cookies } from "next/headers";
import { TIMEZONE_COOKIE } from "./timezone";

export async function getServerTimezone(): Promise<string> {
    const cookieStore = await cookies();
    return cookieStore.get(TIMEZONE_COOKIE)?.value || "America/New_York";
}
