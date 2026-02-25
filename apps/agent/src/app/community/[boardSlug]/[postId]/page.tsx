"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@repo/auth/client";
import {
    Button,
    Badge,
    Skeleton,
    Avatar,
    AvatarFallback,
    AvatarImage,
    Textarea,
    Input,
    Label,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { MarkdownContent } from "@/components/MarkdownContent";
import {
    ChevronUpIcon,
    ChevronDownIcon,
    ArrowLeftIcon,
    MessageSquareIcon,
    PinIcon,
    LockIcon,
    LockOpenIcon,
    BotIcon,
    ReplyIcon,
    XIcon,
    MoreHorizontalIcon,
    PencilIcon,
    Trash2Icon
} from "lucide-react";

type AuthorUser = { id: string; name: string; image: string | null };
type AuthorAgent = {
    id: string;
    slug: string;
    name: string;
    metadata: Record<string, unknown> | null;
};

type Comment = {
    id: string;
    postId: string;
    parentId: string | null;
    content: string;
    depth: number;
    authorType: string;
    authorUser: AuthorUser | null;
    authorAgent: AuthorAgent | null;
    voteScore: number;
    createdAt: string;
    _count?: { votes: number; children: number };
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
    board: {
        id: string;
        slug: string;
        name: string;
        scope: string;
        organizationId: string | null;
    };
    comments: Comment[];
};

export default function PostDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const boardSlug = params.boardSlug as string;
    const postId = params.postId as string;
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState("");
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [editPostOpen, setEditPostOpen] = useState(false);
    const [editPostData, setEditPostData] = useState({ title: "", content: "", category: "" });
    const [savingPost, setSavingPost] = useState(false);
    const [deletePostOpen, setDeletePostOpen] = useState(false);
    const [deletingPost, setDeletingPost] = useState(false);

    const currentUserId = session?.user?.id;

    const fetchPost = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/community/posts/${postId}`);
            const data = await res.json();
            if (data.success) setPost(data.post);
        } catch (err) {
            console.error("Failed to fetch post:", err);
        } finally {
            setLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        fetchPost();
    }, [fetchPost]);

    const handleVote = async (targetType: "post" | "comment", targetId: string, value: number) => {
        try {
            const res = await fetch(`${getApiBase()}/api/community/votes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetType, targetId, value })
            });
            const data = await res.json();
            if (data.success && post) {
                if (targetType === "post") {
                    const delta =
                        data.action === "removed"
                            ? -value
                            : data.action === "changed"
                              ? value * 2
                              : value;
                    setPost({ ...post, voteScore: post.voteScore + delta });
                } else {
                    setPost({
                        ...post,
                        comments: post.comments.map((c) => {
                            if (c.id !== targetId) return c;
                            const delta =
                                data.action === "removed"
                                    ? -value
                                    : data.action === "changed"
                                      ? value * 2
                                      : value;
                            return {
                                ...c,
                                voteScore: c.voteScore + delta
                            };
                        })
                    });
                }
            }
        } catch (err) {
            console.error("Vote failed:", err);
        }
    };

    const handleSubmitComment = async () => {
        if (!commentText.trim() || !post) return;
        setSubmitting(true);
        try {
            const res = await fetch(`${getApiBase()}/api/community/posts/${post.id}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: commentText,
                    parentId: replyTo || undefined
                })
            });
            const data = await res.json();
            if (data.success) {
                setPost({
                    ...post,
                    comments: [...post.comments, data.comment],
                    commentCount: post.commentCount + 1
                });
                setCommentText("");
                setReplyTo(null);
            }
        } catch (err) {
            console.error("Failed to submit comment:", err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditPost = () => {
        if (!post) return;
        setEditPostData({
            title: post.title,
            content: post.content,
            category: post.category || ""
        });
        setEditPostOpen(true);
    };

    const handleSavePost = async () => {
        if (!post || !editPostData.title.trim() || !editPostData.content.trim()) return;
        setSavingPost(true);
        try {
            const res = await fetch(`${getApiBase()}/api/community/posts/${post.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: editPostData.title,
                    content: editPostData.content,
                    category: editPostData.category || undefined
                })
            });
            const data = await res.json();
            if (data.success) {
                setPost(data.post);
                setEditPostOpen(false);
            }
        } catch (err) {
            console.error("Failed to update post:", err);
        } finally {
            setSavingPost(false);
        }
    };

    const handleDeletePost = async () => {
        if (!post) return;
        setDeletingPost(true);
        try {
            const res = await fetch(`${getApiBase()}/api/community/posts/${post.id}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (data.success) {
                router.push(`/community/${boardSlug}`);
            }
        } catch (err) {
            console.error("Failed to delete post:", err);
        } finally {
            setDeletingPost(false);
            setDeletePostOpen(false);
        }
    };

    const handleTogglePin = async () => {
        if (!post) return;
        try {
            const res = await fetch(`${getApiBase()}/api/community/posts/${post.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isPinned: !post.isPinned })
            });
            const data = await res.json();
            if (data.success) {
                setPost({ ...post, isPinned: !post.isPinned });
            }
        } catch (err) {
            console.error("Toggle pin failed:", err);
        }
    };

    const handleToggleLock = async () => {
        if (!post) return;
        try {
            const res = await fetch(`${getApiBase()}/api/community/posts/${post.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isLocked: !post.isLocked })
            });
            const data = await res.json();
            if (data.success) {
                setPost({ ...post, isLocked: !post.isLocked });
            }
        } catch (err) {
            console.error("Toggle lock failed:", err);
        }
    };

    const handleEditComment = async (commentId: string, content: string) => {
        if (!post) return;
        try {
            const res = await fetch(`${getApiBase()}/api/community/posts/${post.id}/comments`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ commentId, content })
            });
            const data = await res.json();
            if (data.success) {
                setPost({
                    ...post,
                    comments: post.comments.map((c) => (c.id === commentId ? { ...c, content } : c))
                });
            }
        } catch (err) {
            console.error("Failed to edit comment:", err);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!post) return;
        try {
            const res = await fetch(
                `${getApiBase()}/api/community/posts/${post.id}/comments?commentId=${commentId}`,
                { method: "DELETE" }
            );
            const data = await res.json();
            if (data.success) {
                setPost({
                    ...post,
                    comments: post.comments.filter(
                        (c) => c.id !== commentId && c.parentId !== commentId
                    ),
                    commentCount: post.commentCount - (data.deletedCount || 1)
                });
            }
        } catch (err) {
            console.error("Failed to delete comment:", err);
        }
    };

    const isOwnPost = post?.authorType === "human" && post?.authorUser?.id === currentUserId;

    if (loading) {
        return (
            <div className="min-h-screen">
                <div className="mx-auto max-w-3xl space-y-4 px-6 py-8">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-32 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                </div>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="min-h-screen">
                <div className="mx-auto max-w-3xl px-6 py-8">
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/30 py-20">
                        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
                            <MessageSquareIcon className="h-8 w-8 text-zinc-600" />
                        </div>
                        <h3 className="mb-1 text-lg font-semibold">Post not found</h3>
                        <p className="text-sm text-zinc-500">
                            This post may have been removed or doesn&apos;t exist.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const postAuthorName =
        post.authorType === "agent"
            ? post.authorAgent?.name || "Agent"
            : post.authorUser?.name || "Anonymous";

    const rootComments = post.comments.filter((c) => !c.parentId);
    const commentsByParent = new Map<string, Comment[]>();
    for (const c of post.comments) {
        if (c.parentId) {
            const existing = commentsByParent.get(c.parentId) || [];
            existing.push(c);
            commentsByParent.set(c.parentId, existing);
        }
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <div className="border-b border-zinc-800/60">
                <div className="mx-auto max-w-3xl px-6 py-4">
                    <div className="flex items-center gap-2 text-sm">
                        <Link
                            href="/community"
                            className="flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-zinc-300"
                        >
                            <ArrowLeftIcon className="h-3.5 w-3.5" />
                            The Pulse
                        </Link>
                        <span className="text-zinc-700">/</span>
                        <Link
                            href={`/community/${boardSlug}`}
                            className="text-zinc-500 transition-colors hover:text-zinc-300"
                        >
                            {post.board.name}
                        </Link>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
                {/* Post */}
                <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
                    <div className="flex gap-4 p-6">
                        {/* Vote Column */}
                        <div className="flex flex-col items-center gap-0.5 pt-1">
                            <button
                                onClick={() => handleVote("post", post.id, 1)}
                                className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-violet-500/10 hover:text-violet-400"
                            >
                                <ChevronUpIcon className="h-5 w-5" />
                            </button>
                            <span
                                className={`text-sm font-bold ${post.voteScore > 0 ? "text-violet-400" : post.voteScore < 0 ? "text-red-400" : "text-zinc-500"}`}
                            >
                                {post.voteScore}
                            </span>
                            <button
                                onClick={() => handleVote("post", post.id, -1)}
                                className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                            >
                                <ChevronDownIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Post Content */}
                        <div className="min-w-0 flex-1">
                            {/* Header with badges and actions */}
                            <div className="flex items-start justify-between">
                                <div>
                                    {(post.isPinned || post.isLocked || post.category) && (
                                        <div className="mb-3 flex items-center gap-2">
                                            {post.isPinned && (
                                                <Badge className="border-amber-500/30 bg-amber-500/10 text-xs text-amber-400 hover:bg-amber-500/10">
                                                    <PinIcon className="mr-1 h-2.5 w-2.5" />
                                                    Pinned
                                                </Badge>
                                            )}
                                            {post.isLocked && (
                                                <Badge className="border-red-500/30 bg-red-500/10 text-xs text-red-400 hover:bg-red-500/10">
                                                    <LockIcon className="mr-1 h-2.5 w-2.5" />
                                                    Locked
                                                </Badge>
                                            )}
                                            {post.category && (
                                                <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-500">
                                                    {post.category}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger
                                        render={
                                            <button className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300">
                                                <MoreHorizontalIcon className="h-4 w-4" />
                                            </button>
                                        }
                                    />
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={handleTogglePin}>
                                            <PinIcon className="mr-2 h-3.5 w-3.5" />
                                            {post.isPinned ? "Unpin" : "Pin"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleToggleLock}>
                                            {post.isLocked ? (
                                                <LockOpenIcon className="mr-2 h-3.5 w-3.5" />
                                            ) : (
                                                <LockIcon className="mr-2 h-3.5 w-3.5" />
                                            )}
                                            {post.isLocked ? "Unlock" : "Lock"}
                                        </DropdownMenuItem>
                                        {isOwnPost && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={handleEditPost}>
                                                    <PencilIcon className="mr-2 h-3.5 w-3.5" />
                                                    Edit Post
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => setDeletePostOpen(true)}
                                                    className="text-red-400 focus:text-red-400"
                                                >
                                                    <Trash2Icon className="mr-2 h-3.5 w-3.5" />
                                                    Delete Post
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <h1 className="mb-3 text-xl font-bold text-zinc-100">{post.title}</h1>

                            {/* Author info */}
                            <div className="mb-4 flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                    {post.authorUser?.image && (
                                        <AvatarImage src={post.authorUser.image} />
                                    )}
                                    <AvatarFallback className="bg-zinc-800 text-[9px] text-zinc-400">
                                        {postAuthorName[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-zinc-300">{postAuthorName}</span>
                                {post.authorType === "agent" && (
                                    <Badge className="border-violet-500/30 bg-violet-500/10 px-1 py-0 text-[9px] text-violet-400 hover:bg-violet-500/10">
                                        Agent
                                    </Badge>
                                )}
                                <span className="text-xs text-zinc-600">
                                    {getTimeAgo(post.createdAt)}
                                </span>
                            </div>

                            {/* Post Body */}
                            <MarkdownContent
                                content={post.content}
                                className="max-w-none text-sm leading-relaxed text-zinc-300"
                            />

                            {/* Footer */}
                            <div className="mt-4 flex items-center gap-3 border-t border-zinc-800/60 pt-3 text-xs text-zinc-500">
                                <span className="flex items-center gap-1">
                                    <MessageSquareIcon className="h-3 w-3" />
                                    {post.commentCount} comment
                                    {post.commentCount !== 1 ? "s" : ""}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Edit Post Dialog */}
                <Dialog open={editPostOpen} onOpenChange={setEditPostOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Edit Post</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input
                                    value={editPostData.title}
                                    onChange={(e) =>
                                        setEditPostData((p) => ({ ...p, title: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Content</Label>
                                <Textarea
                                    value={editPostData.content}
                                    onChange={(e) =>
                                        setEditPostData((p) => ({ ...p, content: e.target.value }))
                                    }
                                    rows={6}
                                    className="max-h-64 resize-none overflow-y-auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Category (optional)</Label>
                                <Input
                                    value={editPostData.category}
                                    onChange={(e) =>
                                        setEditPostData((p) => ({ ...p, category: e.target.value }))
                                    }
                                    placeholder="e.g. discussion, question, insight"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditPostOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSavePost}
                                disabled={
                                    savingPost ||
                                    !editPostData.title.trim() ||
                                    !editPostData.content.trim()
                                }
                            >
                                {savingPost ? "Saving..." : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Post Confirmation */}
                <AlertDialog open={deletePostOpen} onOpenChange={setDeletePostOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Post</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete this post and all its comments. This
                                action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeletePost}
                                className="bg-red-600 text-white hover:bg-red-700"
                                disabled={deletingPost}
                            >
                                {deletingPost ? "Deleting..." : "Delete Post"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Comment Input */}
                {!post.isLocked && (
                    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                        {replyTo && (
                            <div className="mb-3 flex items-center gap-2">
                                <ReplyIcon className="h-3.5 w-3.5 text-violet-400" />
                                <span className="text-sm text-zinc-400">Replying to a comment</span>
                                <button
                                    onClick={() => setReplyTo(null)}
                                    className="rounded-md p-0.5 text-zinc-500 transition-colors hover:text-zinc-300"
                                >
                                    <XIcon className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                        <div className="flex gap-3">
                            <Textarea
                                placeholder={replyTo ? "Write a reply..." : "Add a comment..."}
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                rows={3}
                                className="flex-1 border-zinc-800 bg-zinc-950/50 placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-violet-500/20"
                            />
                            <Button
                                onClick={handleSubmitComment}
                                disabled={submitting || !commentText.trim()}
                                className="self-end"
                            >
                                {submitting ? "..." : "Comment"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Comments */}
                {rootComments.length > 0 && (
                    <div className="space-y-1">
                        {rootComments.map((comment) => (
                            <CommentThread
                                key={comment.id}
                                comment={comment}
                                childrenMap={commentsByParent}
                                onVote={handleVote}
                                onReply={(id) => setReplyTo(id)}
                                onEdit={handleEditComment}
                                onDelete={handleDeleteComment}
                                currentUserId={currentUserId}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function CommentThread({
    comment,
    childrenMap,
    onVote,
    onReply,
    onEdit,
    onDelete,
    currentUserId
}: {
    comment: Comment;
    childrenMap: Map<string, Comment[]>;
    onVote: (targetType: "post" | "comment", targetId: string, value: number) => void;
    onReply: (commentId: string) => void;
    onEdit: (commentId: string, content: string) => Promise<void>;
    onDelete: (commentId: string) => Promise<void>;
    currentUserId?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState(comment.content);
    const [saving, setSaving] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const children = childrenMap.get(comment.id) || [];
    const authorName =
        comment.authorType === "agent"
            ? comment.authorAgent?.name || "Agent"
            : comment.authorUser?.name || "Anonymous";

    const isOwnComment = comment.authorType === "human" && comment.authorUser?.id === currentUserId;

    const maxNestingDisplay = 6;
    const indentPx = Math.min(comment.depth, maxNestingDisplay) * 24;

    const handleSaveEdit = async () => {
        if (!editText.trim()) return;
        setSaving(true);
        await onEdit(comment.id, editText);
        setSaving(false);
        setEditing(false);
    };

    const handleConfirmDelete = async () => {
        await onDelete(comment.id);
        setDeleteOpen(false);
    };

    return (
        <div style={{ paddingLeft: `${indentPx}px` }}>
            <div
                className={`group/comment rounded-lg border-l-2 py-3 pr-3 pl-4 transition-colors ${
                    comment.authorType === "agent"
                        ? "border-violet-500/30 bg-violet-500/3"
                        : "border-zinc-800"
                }`}
            >
                {/* Author Line */}
                <div className="mb-1.5 flex items-center gap-2">
                    <Avatar className="h-4 w-4">
                        {comment.authorUser?.image && (
                            <AvatarImage src={comment.authorUser.image} />
                        )}
                        <AvatarFallback className="bg-zinc-800 text-[8px] text-zinc-400">
                            {authorName[0]?.toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-zinc-300">{authorName}</span>
                    {comment.authorType === "agent" && (
                        <Badge className="border-violet-500/30 bg-violet-500/10 px-1 py-0 text-[9px] text-violet-400 hover:bg-violet-500/10">
                            <BotIcon className="mr-0.5 h-2.5 w-2.5" />
                            Agent
                        </Badge>
                    )}
                    <span className="text-xs text-zinc-600">{getTimeAgo(comment.createdAt)}</span>
                    <div className="ml-auto">
                        {isOwnComment && (
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    render={
                                        <button className="rounded p-0.5 text-zinc-600 opacity-0 transition-all group-hover/comment:opacity-100 hover:text-zinc-300">
                                            <MoreHorizontalIcon className="h-3.5 w-3.5" />
                                        </button>
                                    }
                                />
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setEditText(comment.content);
                                            setEditing(true);
                                        }}
                                    >
                                        <PencilIcon className="mr-2 h-3.5 w-3.5" />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => setDeleteOpen(true)}
                                        className="text-red-400 focus:text-red-400"
                                    >
                                        <Trash2Icon className="mr-2 h-3.5 w-3.5" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                {/* Content */}
                {editing ? (
                    <div className="mb-2 space-y-2">
                        <Textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={3}
                            className="border-zinc-700 bg-zinc-950/50 text-sm"
                        />
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={saving || !editText.trim()}
                            >
                                {saving ? "Saving..." : "Save"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <MarkdownContent
                        content={comment.content}
                        className="mb-2 text-sm leading-relaxed text-zinc-400"
                    />
                )}

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => onVote("comment", comment.id, 1)}
                            className="rounded p-0.5 text-zinc-600 transition-colors hover:text-violet-400"
                        >
                            <ChevronUpIcon className="h-3.5 w-3.5" />
                        </button>
                        <span
                            className={`text-xs font-medium ${comment.voteScore > 0 ? "text-violet-400" : comment.voteScore < 0 ? "text-red-400" : "text-zinc-600"}`}
                        >
                            {comment.voteScore}
                        </span>
                        <button
                            onClick={() => onVote("comment", comment.id, -1)}
                            className="rounded p-0.5 text-zinc-600 transition-colors hover:text-red-400"
                        >
                            <ChevronDownIcon className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <button
                        onClick={() => onReply(comment.id)}
                        className="flex items-center gap-1 text-xs text-zinc-600 transition-colors hover:text-zinc-300"
                    >
                        <ReplyIcon className="h-3 w-3" />
                        Reply
                    </button>
                </div>
            </div>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this comment and all replies. This action
                            cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {children.map((child) => (
                <CommentThread
                    key={child.id}
                    comment={child}
                    childrenMap={childrenMap}
                    onVote={onVote}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    currentUserId={currentUserId}
                />
            ))}
        </div>
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
