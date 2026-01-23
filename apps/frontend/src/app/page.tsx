import { SignInForm } from "@/components/auth/sign-in-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function HomePage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (session) {
        redirect("/dashboard");
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Welcome Back</CardTitle>
                    <CardDescription>Sign in to your account to continue</CardDescription>
                </CardHeader>
                <CardContent>
                    <SignInForm />
                </CardContent>
            </Card>
        </div>
    );
}
