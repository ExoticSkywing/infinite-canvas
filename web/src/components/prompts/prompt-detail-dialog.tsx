"use client";

import { useState, useEffect } from "react";
import { Copy, FolderPlus, Lock, Unlock, ExternalLink, Send, Bookmark, MessageSquare, Share2, Sparkles, X, ChevronLeft, ChevronRight, User } from "lucide-react";
import { Button, Modal, Tag, Input, message, Avatar, Tooltip } from "antd";

import { formatPromptDate, type Prompt } from "@/services/api/prompts";
import { useUserStore } from "@/stores/use-user-store";
import { useThemeStore } from "@/stores/use-theme-store";

const COMMUNITY_UNLOCK_KEY = "infinite-canvas:community-unlocked";

export function PromptDetailDialog({
    prompt,
    onClose,
    onCopy,
    onSaveAsset,
    onPublishToGallery,
}: {
    prompt: Prompt | null;
    onClose: () => void;
    onCopy: (prompt: string) => void;
    onSaveAsset?: (prompt: Prompt) => void;
    onPublishToGallery?: (prompt: Prompt) => void;
}) {
    const [unlocked, setUnlocked] = useState(false);
    const [secretInput, setSecretInput] = useState("");
    const [isSaved, setIsSaved] = useState(false);
    const user = useUserStore((state) => state.user);
    const isAdmin = Boolean(user && user.role === "admin");
    const theme = useThemeStore((state) => state.theme);
    const isDark = theme === "dark";

    useEffect(() => {
        try {
            setUnlocked(localStorage.getItem(COMMUNITY_UNLOCK_KEY) === "1");
        } catch {
            setUnlocked(false);
        }
        setIsSaved(false);
    }, [prompt]);

    const handleUnlockBySecret = () => {
        const val = secretInput.trim().toLowerCase();
        if (val === "canvas" || val === "tg" || val === "creative" || val === "8888" || val === "6666") {
            try {
                localStorage.setItem(COMMUNITY_UNLOCK_KEY, "1");
            } catch {}
            setUnlocked(true);
            message.success("🎉 已成功解锁画廊全量提示词！");
        } else {
            message.error("口令不正确，点击下方链接进入 TG 社群免费获取专属口令");
        }
    };

    const handleCopy = () => {
        if (!prompt) return;
        if (!unlocked) {
            message.warning("🔒 提示词已上锁，请先加入创作者社群输入口令解锁");
            return;
        }
        onCopy(prompt.prompt);
    };

    const handleSave = () => {
        if (!prompt || !onSaveAsset) return;
        if (!unlocked) {
            message.warning("🔒 请先解锁后再加入素材库");
            return;
        }
        onSaveAsset(prompt);
        setIsSaved(true);
    };

    const handleShare = () => {
        if (typeof window !== "undefined") {
            navigator.clipboard.writeText(window.location.href);
            message.success("作品链接已复制到剪贴板");
        }
    };

    return (
        <Modal
            open={Boolean(prompt)}
            onCancel={onClose}
            footer={null}
            closable={false}
            width={1120}
            centered
            wrapClassName={isDark ? "dark" : ""}
            rootClassName={isDark ? "dark" : ""}
            styles={{
                content: {
                    padding: 0,
                    borderRadius: 24,
                    overflow: "hidden",
                    backgroundColor: "transparent",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
                },
                body: { padding: 0 },
            }}
        >
            {prompt ? (
                <div className="relative flex flex-col md:flex-row h-[88vh] max-h-[820px] w-full bg-white dark:bg-[#141416] text-stone-900 dark:text-stone-100 rounded-[24px] overflow-hidden border border-stone-200/80 dark:border-stone-800/80 shadow-2xl">
                    {/* 关闭按钮 */}
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 z-30 flex size-8 items-center justify-center rounded-full bg-stone-100/80 text-stone-600 hover:bg-stone-200 hover:text-stone-900 dark:bg-stone-800/80 dark:text-stone-300 dark:hover:bg-stone-700 transition"
                    >
                        <X className="size-4" />
                    </button>

                    {/* 左侧：沉浸式媒体大图展厅 */}
                    <div className="relative flex flex-1 items-center justify-center bg-stone-950 p-6 overflow-hidden select-none">
                        <img
                            src={prompt.coverUrl}
                            alt={prompt.title}
                            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl transition duration-300"
                        />
                        {/* 左上角分类/格式胶囊徽章 */}
                        <div className="absolute left-6 top-6 flex items-center gap-2">
                            <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md border border-white/10 shadow-sm">
                                {prompt.category || "作品展示"}
                            </span>
                        </div>
                    </div>

                    {/* 右侧：交互式作品详情侧栏 */}
                    <div className="flex w-full md:w-[440px] flex-col justify-between border-t md:border-t-0 md:border-l border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141416]">
                        {/* 顶部：创作者信息栏 */}
                        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800/60 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <Avatar
                                    size={38}
                                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=CreativeCanvas"
                                    className="border border-stone-200 dark:border-stone-700 shadow-sm"
                                    icon={<User />}
                                />
                                <div>
                                    <div className="flex items-center gap-1.5 text-sm font-semibold text-stone-900 dark:text-stone-100">
                                        <span>@InfiniteCreator</span>
                                        <Sparkles className="size-3.5 text-amber-500" />
                                    </div>
                                    <div className="text-[11px] text-stone-400">
                                        收录时间 · {formatPromptDate(prompt.createdAt)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 pr-6">
                                <Tooltip title={unlocked ? "社群专属解锁已生效" : "加入社群口令保护"}>
                                    <span className="flex size-7 items-center justify-center rounded-full bg-stone-100 text-stone-500 dark:bg-stone-800/80 dark:text-stone-400">
                                        {unlocked ? <Unlock className="size-3.5 text-emerald-500" /> : <Lock className="size-3.5 text-amber-500" />}
                                    </span>
                                </Tooltip>
                            </div>
                        </div>

                        {/* 中间：可滚动详情主内容 */}
                        <div className="flex-1 overflow-y-auto px-6 py-5 thin-scrollbar space-y-5">
                            {/* 作品标题 */}
                            <div>
                                <h1 className="text-lg font-bold tracking-tight text-stone-950 dark:text-stone-50 leading-snug">
                                    {prompt.title}
                                </h1>
                                <div className="mt-2.5 flex flex-wrap gap-1.5">
                                    {prompt.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 dark:bg-stone-800/80 dark:text-stone-300 border border-stone-200/50 dark:border-stone-700/50"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 提示词卡片 */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-stone-600 dark:text-stone-300">提示词</span>
                                    <button
                                        onClick={handleCopy}
                                        className="flex items-center gap-1 font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition"
                                    >
                                        <Copy className="size-3.5" />
                                        <span>复制</span>
                                    </button>
                                </div>

                                <div className="relative h-60 w-full overflow-hidden rounded-2xl border border-stone-200/90 bg-stone-50/90 p-4 shadow-sm dark:border-stone-800/90 dark:bg-stone-900/60">
                                    <div className={`h-full w-full overflow-y-auto pr-1 thin-scrollbar ${unlocked ? "" : "select-none filter blur-sm transition-all duration-300 pointer-events-none"}`}>
                                        <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-stone-800 dark:text-stone-200">
                                            {prompt.prompt}
                                        </p>
                                    </div>

                                    {/* 社群口令遮罩层 */}
                                    {!unlocked ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/75 p-5 text-center backdrop-blur-md shadow-inner dark:bg-stone-950/85">
                                            <div className="mb-2 grid size-10 place-items-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950/80 dark:text-sky-400">
                                                <Lock className="size-4" />
                                            </div>
                                            <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                                                加入创作者社群 · 免费解锁完整提示词
                                            </div>
                                            <p className="mt-1 max-w-xs text-[11px] text-stone-500 dark:text-stone-400 leading-normal">
                                                输入社群专属口令（如 <span className="font-mono font-medium text-sky-600 dark:text-sky-400">canvas</span>）即可一键复制所有工业级提示词
                                            </p>
                                            <div className="mt-3 flex w-full max-w-xs items-center gap-2">
                                                <Input
                                                    size="small"
                                                    placeholder="输入口令 (如 canvas)"
                                                    value={secretInput}
                                                    onChange={(e) => setSecretInput(e.target.value)}
                                                    onPressEnter={handleUnlockBySecret}
                                                    className="text-xs"
                                                />
                                                <Button size="small" type="primary" onClick={handleUnlockBySecret}>
                                                    解锁
                                                </Button>
                                            </div>
                                            <div className="mt-2.5 flex items-center gap-1.5 text-[11px]">
                                                <a
                                                    href="https://t.me/+79284242188"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 font-medium text-sky-600 hover:underline dark:text-sky-400"
                                                >
                                                    <Send className="size-2.5" />
                                                    进入 Telegram 社群免费领口令
                                                    <ExternalLink className="size-2.5" />
                                                </a>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {/* 底部：对标主流作品卡片的轻量交互功能栏 */}
                        <div className="border-t border-stone-100 dark:border-stone-800/80 p-4 bg-stone-50/50 dark:bg-stone-900/30">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    {onSaveAsset ? (
                                        <button
                                            onClick={handleSave}
                                            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium border transition ${
                                                isSaved
                                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                                                    : "bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-stone-300"
                                            }`}
                                        >
                                            <Bookmark className="size-3.5" />
                                            <span>{isSaved ? "已收藏" : "加入素材"}</span>
                                        </button>
                                    ) : null}
                                    <button
                                        onClick={handleShare}
                                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-stone-300 transition"
                                    >
                                        <Share2 className="size-3.5" />
                                        <span>分享</span>
                                    </button>
                                    {isAdmin && onPublishToGallery ? (
                                        <button
                                            type="button"
                                            onClick={() => prompt && onPublishToGallery(prompt)}
                                            className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium border border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400 transition"
                                        >
                                            <Sparkles className="size-3.5 text-amber-500" />
                                            <span>收录到画廊</span>
                                        </button>
                                    ) : null}
                                </div>
                                <Button
                                    type="primary"
                                    size="middle"
                                    icon={unlocked ? <Copy className="size-3.5" /> : <Lock className="size-3.5" />}
                                    onClick={handleCopy}
                                    className="rounded-full px-5 text-xs font-semibold shadow-sm"
                                >
                                    {unlocked ? "复制 Prompt" : "解锁提示词"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </Modal>
    );
}
