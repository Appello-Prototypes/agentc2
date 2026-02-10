"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, XIcon } from "lucide-react";
import { Badge, Button, cn } from "@repo/ui";

interface QuestionOption {
    label: string;
    value: string;
    recommended?: boolean;
}

interface Question {
    id: string;
    question: string;
    options: QuestionOption[];
    allowFreeform: boolean;
    allowSkip: boolean;
}

interface InteractiveQuestionsProps {
    questions: Question[];
    onComplete: (answers: Record<string, string>) => void;
    completed?: boolean;
    answers?: Record<string, string>;
}

/**
 * CoWork-style Interactive Questions Widget
 *
 * Two modes:
 * - Active: Paginated question cards with numbered options, keyboard nav
 * - Summary: Compact grouped Q&A card after all questions answered
 */
export function InteractiveQuestions({
    questions,
    onComplete,
    completed,
    answers: completedAnswers
}: InteractiveQuestionsProps) {
    // ── Summary mode ─────────────────────────────────────────────────────
    if (completed && completedAnswers) {
        return (
            <div className="bg-muted/30 my-2 rounded-lg border p-4">
                {questions.map((q) => (
                    <div key={q.id} className="mb-2 last:mb-0">
                        <div className="text-sm">{q.question}</div>
                        <div className="text-muted-foreground text-sm">
                            {completedAnswers[q.id] || <span className="italic">[Skipped]</span>}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // ── Guard: empty or invalid questions ────────────────────────────────
    if (!questions || questions.length === 0) {
        return null;
    }

    // ── Active mode ──────────────────────────────────────────────────────
    return <ActiveQuestions questions={questions} onComplete={onComplete} />;
}

/**
 * Active question carousel with keyboard navigation
 */
function ActiveQuestions({
    questions,
    onComplete
}: {
    questions: Question[];
    onComplete: (answers: Record<string, string>) => void;
}) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [focusedOption, setFocusedOption] = useState(0);
    const [freeformValue, setFreeformValue] = useState("");
    const [showFreeform, setShowFreeform] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const totalQuestions = questions.length;
    // Clamp currentIndex to valid range
    const safeIndex = Math.min(Math.max(0, currentIndex), Math.max(0, totalQuestions - 1));
    const question = questions[safeIndex] as Question | undefined;
    const isLastQuestion = safeIndex === totalQuestions - 1;

    // Select an answer and advance
    const handleSelect = useCallback(
        (value: string) => {
            if (!question) return;
            const newAnswers = { ...answers, [question.id]: value };
            setAnswers(newAnswers);
            setShowFreeform(false);
            setFreeformValue("");
            setFocusedOption(0);

            if (isLastQuestion) {
                onComplete(newAnswers);
            } else {
                setCurrentIndex((prev) => prev + 1);
            }
        },
        [answers, question, isLastQuestion, onComplete]
    );

    // Skip current question
    const handleSkip = useCallback(() => {
        const newAnswers = { ...answers };
        // Don't set a value for skipped questions
        setShowFreeform(false);
        setFreeformValue("");
        setFocusedOption(0);

        if (isLastQuestion) {
            onComplete(newAnswers);
        } else {
            setCurrentIndex((prev) => prev + 1);
        }
    }, [answers, isLastQuestion, onComplete]);

    // Dismiss (complete with whatever we have)
    const handleDismiss = useCallback(() => {
        onComplete(answers);
    }, [answers, onComplete]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showFreeform) {
                if (e.key === "Escape") {
                    setShowFreeform(false);
                    e.preventDefault();
                }
                return;
            }

            switch (e.key) {
                case "ArrowUp":
                    setFocusedOption((prev) => Math.max(0, prev - 1));
                    e.preventDefault();
                    break;
                case "ArrowDown":
                    setFocusedOption((prev) =>
                        Math.min((question?.options.length ?? 1) - 1, prev + 1)
                    );
                    e.preventDefault();
                    break;
                case "ArrowLeft":
                    if (currentIndex > 0) {
                        setCurrentIndex((prev) => prev - 1);
                        setFocusedOption(0);
                    }
                    e.preventDefault();
                    break;
                case "ArrowRight":
                    if (currentIndex < totalQuestions - 1) {
                        setCurrentIndex((prev) => prev + 1);
                        setFocusedOption(0);
                    }
                    e.preventDefault();
                    break;
                case "Enter":
                    if (question?.options[focusedOption]) {
                        handleSelect(question.options[focusedOption].value);
                    }
                    e.preventDefault();
                    break;
                case "Escape":
                    if (question?.allowSkip) {
                        handleSkip();
                    }
                    e.preventDefault();
                    break;
            }
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener("keydown", handleKeyDown);
            container.focus();
        }

        return () => {
            if (container) {
                container.removeEventListener("keydown", handleKeyDown);
            }
        };
    }, [
        currentIndex,
        focusedOption,
        question,
        totalQuestions,
        showFreeform,
        handleSelect,
        handleSkip
    ]);

    // Guard: if no question available (shouldn't happen given parent guard)
    if (!question) return null;

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            className="bg-card my-2 rounded-lg border shadow-sm outline-none"
        >
            {/* Header with question and pagination */}
            <div className="flex items-start justify-between border-b px-4 py-3">
                <div className="flex-1 text-sm font-medium">{question.question}</div>
                <div className="ml-4 flex items-center gap-2">
                    {totalQuestions > 1 && (
                        <div className="text-muted-foreground flex items-center gap-1 text-xs">
                            <button
                                onClick={() => {
                                    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
                                }}
                                disabled={currentIndex === 0}
                                className="hover:text-foreground disabled:opacity-30"
                            >
                                <ChevronLeftIcon className="size-3.5" />
                            </button>
                            <span>
                                {currentIndex + 1} of {totalQuestions}
                            </span>
                            <button
                                onClick={() => {
                                    if (currentIndex < totalQuestions - 1)
                                        setCurrentIndex((prev) => prev + 1);
                                }}
                                disabled={currentIndex === totalQuestions - 1}
                                className="hover:text-foreground disabled:opacity-30"
                            >
                                <ChevronRightIcon className="size-3.5" />
                            </button>
                        </div>
                    )}
                    <button
                        onClick={handleDismiss}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <XIcon className="size-3.5" />
                    </button>
                </div>
            </div>

            {/* Options */}
            <div className="px-4 py-2">
                {question.options.map((option, i) => (
                    <button
                        key={option.value}
                        onClick={() => handleSelect(option.value)}
                        className={cn(
                            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                            focusedOption === i
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent/50"
                        )}
                        onMouseEnter={() => setFocusedOption(i)}
                    >
                        <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded border text-xs">
                            {i + 1}
                        </span>
                        <span className="flex-1">{option.label}</span>
                        {option.recommended && (
                            <Badge
                                variant="outline"
                                className="text-primary border-primary/30 text-[10px]"
                            >
                                Recommended
                            </Badge>
                        )}
                    </button>
                ))}

                {/* Freeform input */}
                {question.allowFreeform && (
                    <>
                        {showFreeform ? (
                            <div className="mt-1 flex items-center gap-2 px-3 py-2">
                                <PencilIcon className="text-muted-foreground size-3.5 shrink-0" />
                                <input
                                    type="text"
                                    value={freeformValue}
                                    onChange={(e) => setFreeformValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && freeformValue.trim()) {
                                            handleSelect(freeformValue.trim());
                                        }
                                    }}
                                    placeholder="Something else..."
                                    className="flex-1 bg-transparent text-sm outline-none"
                                    autoFocus
                                />
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowFreeform(true)}
                                className="text-muted-foreground hover:text-foreground mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors"
                            >
                                <PencilIcon className="size-3.5" />
                                <span>Something else</span>
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Footer with skip and keyboard hints */}
            <div className="text-muted-foreground flex items-center justify-between border-t px-4 py-2 text-[10px]">
                <span>
                    {"\u2191\u2193"} to navigate {"\u00B7"} Enter to select
                    {question.allowSkip && <> {"\u00B7"} Esc to skip</>}
                </span>
                {question.allowSkip && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSkip}
                        className="text-muted-foreground h-6 px-2 text-[10px]"
                    >
                        Skip
                    </Button>
                )}
            </div>
        </div>
    );
}
