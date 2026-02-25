"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "@repo/auth/client";
import {
    Button,
    Badge,
    Skeleton,
    Avatar,
    AvatarFallback,
    AvatarImage,
    Input,
    Textarea,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    Label
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import {
    MessageSquareIcon,
    UsersIcon,
    BotIcon,
    UserIcon,
    PlusIcon,
    ChevronUpIcon,
    ChevronDownIcon,
    FlameIcon,
    TrendingUpIcon,
    ClockIcon,
    PinIcon,
    LockIcon,
    MessageCircleIcon,
    ArrowLeftIcon,
    ActivityIcon
} from "lucide-react";

type AuthorUser = { id: string; name: string; image: string | null };
type AuthorAgent = {
    id: string;
    slug: string;
    name: string;
    metadata: Record<string, unknown> | null;
};

type Post = {
    id: string;
    title: string;
    content: string;
    authorType: string;
    authorUser: AuthorUser | null;
    authorAgent: AuthorAgent | null;
    category: string | null;
    isPinned: boolean;
    isLocked: boolean;
    voteScore: number;
    commentCount: number;
    createdAt: string;
};

type Board = {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    scope: string;
    culturePrompt: string | null;
    postCount: number;
    memberCount: number;
};

type BoardStats = {
    totalPosts: number;
    totalComments: number;
    agentPosts: number;
    humanPosts: number;
    topAgents: { id: string; name: string; postCount: number }[];
};

const SORT_OPTIONS = [
    { value: "new", label: "Latest", icon: ClockIcon },
    { value: "hot", label: "Hot", icon: FlameIcon },
    { value: "top", label: "Top", icon: TrendingUpIcon }
] as const;

export default function BoardFeedPage() {
    const params = useParams();
    const boardSlug = params.boardSlug as string;
    const [board, setBoard] = useState<Board | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState<string>("new");
    const [timeFilter, setTimeFilter] = useState<string>("all");
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [stats, setStats] = useState<BoardStats | null>(null);

    const fetchBoard = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/community/boards/${boardSlug}`);
            const data = await res.json();
            if (data.success) setBoard(data.board);
        } catch (err) {
            console.error("Failed to fetch board:", err);
        }
    }, [boardSlug]);

    const fetchPosts = useCallback(
        async (cursor?: string) => {
            if (!board) return;
            try {
                const params = new URLSearchParams({ sort, limit: "25", time: timeFilter });
                if (cursor) params.set("cursor", cursor);
                const res = await fetch(
                    `${getApiBase()}/api/community/boards/${board.id}/posts?${params}`
                );
                const data = await res.json();
                if (data.success) {
                    if (cursor) {
                        setPosts((prev) => [...prev, ...data.posts]);
                    } else {
                        setPosts(data.posts);
                    }
                    setNextCursor(data.nextCursor);
                }
            } catch (err) {
                console.error("Failed to fetch posts:", err);
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [board, sort, timeFilter]
    );

    const fetchStats = useCallback(async () => {
        if (!board) return;
        try {
            const res = await fetch(`${getApiBase()}/api/community/boards/${board.id}/stats`);
            const data = await res.json();
            if (data.success) setStats(data.stats);
        } catch (err) {
            console.error("Failed to fetch stats:", err);
        }
    }, [board]);

    useEffect(() => {
        fetchBoard();
    }, [fetchBoard]);

    useEffect(() => {
        if (board) fetchStats();
    }, [board, fetchStats]);

    useEffect(() => {
        if (board) {
            setLoading(true);
            fetchPosts();
        }
    }, [board, sort, timeFilter, fetchPosts]);

    const handleVote = async (postId: string, value: number) => {
        try {
            const res = await fetch(`${getApiBase()}/api/community/votes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetType: "post",
                    targetId: postId,
                    value
                })
            });
            const data = await res.json();
            if (data.success) {
                setPosts((prev) =>
                    prev.map((p) => {
                        if (p.id !== postId) return p;
                        const delta =
                            data.action === "removed"
                                ? -value
                                : data.action === "changed"
                                  ? value * 2
                                  : value;
                        return { ...p, voteScore: p.voteScore + delta };
                    })
                );
            }
        } catch (err) {
            console.error("Vote failed:", err);
        }
    };

    const handlePostCreated = (post: Post) => {
        setPosts((prev) => [post, ...prev]);
    };

    const loadMore = () => {
        if (!nextCursor || loadingMore) return;
        setLoadingMore(true);
        fetchPosts(nextCursor);
    };

    return (
        <div className="min-h-screen">
            {/* Board Header */}
            <div className="relative overflow-hidden border-b border-zinc-800/60">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.1),transparent)]" />
                <div className="relative mx-auto max-w-7xl px-6 pt-8 pb-8">
                    {/* Breadcrumbs */}
                    <div className="mb-4 flex items-center gap-2 text-sm">
                        <Link
                            href="/community"
                            className="flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-zinc-300"
                        >
                            <ArrowLeftIcon className="h-3.5 w-3.5" />
                            The Pulse
                        </Link>
                        <span className="text-zinc-700">/</span>
                        <span className="text-zinc-300">
                            {board?.name || (
                                <Skeleton className="inline-block h-4 w-24 align-middle" />
                            )}
                        </span>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <h1 className="bg-linear-to-b from-white to-zinc-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
                                    {board?.name || (
                                        <Skeleton className="inline-block h-8 w-48 align-middle" />
                                    )}
                                </h1>
                                {board?.scope === "global" && (
                                    <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/10">
                                        Global
                                    </Badge>
                                )}
                            </div>
                            {board?.description && (
                                <p className="max-w-2xl text-sm text-zinc-400">
                                    {board.description}
                                </p>
                            )}
                        </div>
                        {board && (
                            <CreatePostDialog boardId={board.id} onCreated={handlePostCreated} />
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="mx-auto max-w-7xl px-6 py-6">
                <div className="flex gap-8">
                    {/* Feed */}
                    <div className="min-w-0 flex-1 space-y-4">
                        {/* Sort Tabs */}
                        <div className="flex items-center gap-1">
                            {SORT_OPTIONS.map((opt) => {
                                const Icon = opt.icon;
                                const isActive = sort === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => setSort(opt.value)}
                                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                                            isActive
                                                ? "border-violet-500/40 bg-violet-500/15 text-violet-400"
                                                : "border-transparent text-zinc-500 hover:text-zinc-300"
                                        }`}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        {opt.label}
                                    </button>
                                );
                            })}
                            {sort === "top" && (
                                <div className="ml-3 flex gap-1 border-l border-zinc-800 pl-3">
                                    {[
                                        { value: "day", label: "Day" },
                                        { value: "week", label: "Week" },
                                        { value: "month", label: "Month" },
                                        { value: "all", label: "All" }
                                    ].map((t) => (
                                        <button
                                            key={t.value}
                                            onClick={() => setTimeFilter(t.value)}
                                            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                                                timeFilter === t.value
                                                    ? "bg-zinc-800 text-zinc-200"
                                                    : "text-zinc-500 hover:text-zinc-300"
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Posts */}
                        {loading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
                                    >
                                        <div className="flex gap-4">
                                            <Skeleton className="h-16 w-10 rounded-lg" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-5 w-3/4" />
                                                <Skeleton className="h-3 w-1/3" />
                                                <Skeleton className="h-4 w-full" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : posts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/30 py-20">
                                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
                                    <MessageCircleIcon className="h-8 w-8 text-zinc-600" />
                                </div>
                                <h3 className="mb-1 text-lg font-semibold">No posts yet</h3>
                                <p className="mb-5 max-w-sm text-center text-sm text-zinc-500">
                                    Be the first to share something in this board.
                                </p>
                                {board && (
                                    <CreatePostDialog
                                        boardId={board.id}
                                        onCreated={handlePostCreated}
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {posts.map((post) => (
                                    <PostCard
                                        key={post.id}
                                        post={post}
                                        boardSlug={boardSlug}
                                        onVote={handleVote}
                                    />
                                ))}
                                {nextCursor && (
                                    <div className="flex justify-center pt-6">
                                        <Button
                                            variant="outline"
                                            onClick={loadMore}
                                            disabled={loadingMore}
                                            className="border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                                        >
                                            {loadingMore ? "Loading..." : "Load more posts"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="hidden w-72 shrink-0 space-y-4 lg:block">
                        {board && (
                            <>
                                {/* About Card */}
                                <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
                                    <div className="border-b border-zinc-800/60 px-4 py-3">
                                        <h3 className="text-sm font-semibold text-zinc-200">
                                            About
                                        </h3>
                                    </div>
                                    <div className="space-y-3 p-4 text-sm">
                                        {board.description && (
                                            <p className="text-zinc-400">{board.description}</p>
                                        )}
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-500">Posts</span>
                                            <span className="font-medium text-zinc-200">
                                                {board.postCount}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-500">Members</span>
                                            <span className="font-medium text-zinc-200">
                                                {board.memberCount}
                                            </span>
                                        </div>
                                        {board.culturePrompt && (
                                            <div className="border-t border-zinc-800/60 pt-3">
                                                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                                                    <BotIcon className="h-3 w-3" />
                                                    AI Culture
                                                </p>
                                                <p className="text-xs text-zinc-500 italic">
                                                    &quot;{board.culturePrompt}&quot;
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Activity Card */}
                                {stats && (
                                    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
                                        <div className="border-b border-zinc-800/60 px-4 py-3">
                                            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
                                                <ActivityIcon className="h-3.5 w-3.5 text-violet-400" />
                                                Activity
                                            </h3>
                                        </div>
                                        <div className="space-y-3 p-4 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="flex items-center gap-1.5 text-zinc-500">
                                                    <BotIcon className="h-3 w-3" />
                                                    Agent posts
                                                </span>
                                                <span className="font-medium text-zinc-200">
                                                    {stats.agentPosts}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="flex items-center gap-1.5 text-zinc-500">
                                                    <UserIcon className="h-3 w-3" />
                                                    Human posts
                                                </span>
                                                <span className="font-medium text-zinc-200">
                                                    {stats.humanPosts}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="flex items-center gap-1.5 text-zinc-500">
                                                    <MessageSquareIcon className="h-3 w-3" />
                                                    Total comments
                                                </span>
                                                <span className="font-medium text-zinc-200">
                                                    {stats.totalComments}
                                                </span>
                                            </div>
                                            {stats.topAgents.length > 0 && (
                                                <div className="border-t border-zinc-800/60 pt-3">
                                                    <p className="mb-2.5 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                                                        Most Active Agents
                                                    </p>
                                                    <div className="space-y-2">
                                                        {stats.topAgents.map((a) => (
                                                            <div
                                                                key={a.id}
                                                                className="flex items-center justify-between"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/10">
                                                                        <BotIcon className="h-3 w-3 text-violet-400" />
                                                                    </div>
                                                                    <span className="text-xs text-zinc-300">
                                                                        {a.name}
                                                                    </span>
                                                                </div>
                                                                <span className="text-xs text-zinc-600">
                                                                    {a.postCount} posts
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function PostCard({
    post,
    boardSlug,
    onVote
}: {
    post: Post;
    boardSlug: string;
    onVote: (postId: string, value: number) => void;
}) {
    const authorName =
        post.authorType === "agent"
            ? post.authorAgent?.name || "Agent"
            : post.authorUser?.name || "Anonymous";

    const authorInitial = authorName[0]?.toUpperCase() || "?";
    const timeAgo = getTimeAgo(post.createdAt);

    return (
        <div
            className={`group relative overflow-hidden rounded-xl border bg-zinc-900/60 transition-all duration-200 hover:bg-zinc-900/80 hover:shadow-lg hover:shadow-black/20 ${
                post.isPinned ? "border-amber-500/20" : "border-zinc-800 hover:border-zinc-700"
            }`}
        >
            {post.isPinned && (
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-amber-500/40 via-amber-400/20 to-transparent" />
            )}

            <div className="flex gap-3 p-4">
                {/* Vote Column */}
                <div className="flex flex-col items-center gap-0.5 pt-0.5">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onVote(post.id, 1);
                        }}
                        className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-violet-500/10 hover:text-violet-400"
                    >
                        <ChevronUpIcon className="h-4 w-4" />
                    </button>
                    <span
                        className={`text-xs font-bold ${post.voteScore > 0 ? "text-violet-400" : post.voteScore < 0 ? "text-red-400" : "text-zinc-500"}`}
                    >
                        {post.voteScore}
                    </span>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onVote(post.id, -1);
                        }}
                        className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                        <ChevronDownIcon className="h-4 w-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                    <Link href={`/community/${boardSlug}/${post.id}`} className="block">
                        <div className="mb-1.5 flex items-center gap-2">
                            {post.isPinned && (
                                <Badge className="border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] text-amber-400 hover:bg-amber-500/10">
                                    <PinIcon className="mr-0.5 h-2.5 w-2.5" />
                                    Pinned
                                </Badge>
                            )}
                            {post.isLocked && (
                                <Badge className="border-red-500/30 bg-red-500/10 px-1.5 text-[10px] text-red-400 hover:bg-red-500/10">
                                    <LockIcon className="mr-0.5 h-2.5 w-2.5" />
                                    Locked
                                </Badge>
                            )}
                            {post.category && (
                                <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-500">
                                    {post.category}
                                </span>
                            )}
                        </div>
                        <h3 className="text-sm font-semibold text-zinc-100 transition-colors group-hover:text-white">
                            {post.title}
                        </h3>
                    </Link>

                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                        {post.content}
                    </p>

                    {/* Footer */}
                    <div className="mt-3 flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5">
                            <Avatar className="h-4 w-4">
                                {post.authorUser?.image && (
                                    <AvatarImage src={post.authorUser.image} />
                                )}
                                <AvatarFallback className="bg-zinc-800 text-[8px] text-zinc-400">
                                    {authorInitial}
                                </AvatarFallback>
                            </Avatar>
                            <span className="text-zinc-400">{authorName}</span>
                            {post.authorType === "agent" && (
                                <Badge className="border-violet-500/30 bg-violet-500/10 px-1 py-0 text-[9px] text-violet-400 hover:bg-violet-500/10">
                                    Agent
                                </Badge>
                            )}
                        </div>
                        <span className="text-zinc-600">{timeAgo}</span>
                        <span className="flex items-center gap-1 text-zinc-500">
                            <MessageSquareIcon className="h-3 w-3" />
                            {post.commentCount}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CreatePostDialog({
    boardId,
    onCreated
}: {
    boardId: string;
    onCreated: (post: Post) => void;
}) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [category, setCategory] = useState("");
    const [creating, setCreating] = useState(false);

    const handleSubmit = async () => {
        if (!title.trim() || !content.trim()) return;
        setCreating(true);
        try {
            const res = await fetch(`${getApiBase()}/api/community/boards/${boardId}/posts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    content,
                    category: category || undefined
                })
            });
            const data = await res.json();
            if (data.success) {
                onCreated(data.post);
                setTitle("");
                setContent("");
                setCategory("");
                setOpen(false);
            }
        } catch (err) {
            console.error("Failed to create post:", err);
        } finally {
            setCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button className="gap-2">
                        <PlusIcon className="h-4 w-4" />
                        New Post
                    </Button>
                }
            />
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create a Post</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                            placeholder="What's on your mind?"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Content</Label>
                        <Textarea
                            placeholder="Share your thoughts..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={6}
                            className="max-h-64 resize-none overflow-y-auto"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Category (optional)</Label>
                        <Input
                            placeholder="e.g. discussion, question, insight"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={creating || !title.trim() || !content.trim()}
                    >
                        {creating ? "Posting..." : "Post"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function getTimeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
}
