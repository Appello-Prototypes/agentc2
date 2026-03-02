"use client";

import { Card, CardContent, Skeleton } from "@repo/ui";

export function FeedSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                    <CardContent className="p-4 pl-5">
                        <div className="flex items-start gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-16 rounded-full" />
                                </div>
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
