"use client";

import { FolderPlus, RotateCcw, Search } from "lucide-react";
import { type UIEvent, useEffect, useMemo, useState } from "react";
import { App, Button, Empty, Input, Spin, Tag } from "antd";

import { PromptCard } from "@/components/prompts/prompt-card";
import { PromptDetailDialog } from "@/components/prompts/prompt-detail-dialog";
import { usePromptList } from "@/components/prompts/use-prompt-list";
import { useCopyText } from "@/hooks/use-copy-text";
import { cn } from "@/lib/utils";
import { useAssetStore } from "@/stores/use-asset-store";
import { ALL_PROMPTS_OPTION, type Prompt } from "@/services/api/prompts";

const REMOTE_CATEGORIES = new Set([
    "system",
    "gpt-image-2-prompts",
    "awesome-gpt-image",
    "awesome-gpt4o-image-prompts",
    "xianyu-awesome-gptimage2",
    "youmind-gpt-image-2",
    "youmind-nano-banana-pro",
    "davidwu-gpt-image2-prompts",
]);

export default function PromptsPage() {
    const { message } = App.useApp();
    const [titleInput, setTitleInput] = useState("");
    const [titleKeyword, setTitleKeyword] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState(ALL_PROMPTS_OPTION);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const addAsset = useAssetStore((state) => state.addAsset);
    const copyText = useCopyText();

    const { query, items: allItems, tags: promptTags, categories: allCategories } = usePromptList({
        keyword: titleKeyword,
        tags: selectedTags,
        category: selectedCategory,
        scope: "gallery",
    });

    // 画廊对外门面：严格过滤掉上游未经把关的仓库源，仅展示精选/原创作品
    const promptItems = useMemo(
        () => allItems.filter((item) => !REMOTE_CATEGORIES.has(item.category)),
        [allItems]
    );

    // 稳定保持分类与标签池（避免关键词搜索或单项筛选导致分类与标签在前端消失）
    const [knownCategories, setKnownCategories] = useState<string[]>([]);
    const [knownTags, setKnownTags] = useState<string[]>([]);

    useEffect(() => {
        if (allCategories && allCategories.length > 0) {
            setKnownCategories((prev) => {
                const filtered = allCategories.filter((c) => c && c !== ALL_PROMPTS_OPTION && !REMOTE_CATEGORIES.has(c));
                const set = new Set([...prev, ...filtered]);
                return Array.from(set);
            });
        }
        if (promptTags && promptTags.length > 0) {
            setKnownTags((prev) => {
                const filtered = promptTags.filter((t) => t && t !== ALL_PROMPTS_OPTION);
                const set = new Set([...prev, ...filtered]);
                return Array.from(set);
            });
        }
    }, [allCategories, promptTags]);

    useEffect(() => {
        if (promptItems.length > 0) {
            setKnownCategories((prev) => {
                const cats = promptItems.map((item) => item.category).filter(Boolean);
                const set = new Set([...prev, ...cats]);
                return Array.from(set);
            });
            setKnownTags((prev) => {
                const tags = promptItems.flatMap((item) => item.tags || []).filter(Boolean);
                const set = new Set([...prev, ...tags]);
                return Array.from(set);
            });
        }
    }, [promptItems]);

    const promptCategoryOptions = useMemo(
        () => [ALL_PROMPTS_OPTION, ...knownCategories],
        [knownCategories]
    );

    const promptTagOptions = useMemo(
        () => [ALL_PROMPTS_OPTION, ...knownTags],
        [knownTags]
    );

    const hasActiveFilters = Boolean(
        titleKeyword.trim() ||
        selectedTags.length > 0 ||
        selectedCategory !== ALL_PROMPTS_OPTION
    );

    const resetAllFilters = () => {
        setTitleInput("");
        setTitleKeyword("");
        setSelectedTags([]);
        setSelectedCategory(ALL_PROMPTS_OPTION);
    };

    useEffect(() => {
        if (query.isError) {
            message.error(query.error instanceof Error ? query.error.message : "获取作品失败");
        }
    }, [message, query.error, query.isError]);

    const toggleTag = (tag: string) => {
        if (tag === ALL_PROMPTS_OPTION) {
            setSelectedTags([]);
            return;
        }
        setSelectedTags((items) => (items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag]));
    };

    const savePromptAsset = (item: Prompt) => {
        addAsset({
            kind: "text",
            title: item.title,
            coverUrl: item.coverUrl,
            tags: item.tags,
            source: item.category,
            data: { content: item.prompt },
            metadata: { source: "prompt-library", promptId: item.id, githubUrl: item.githubUrl },
        });
        message.success("已加入我的素材");
    };

    const handleSearch = (value?: string) => {
        const text = (value !== undefined ? value : titleInput).trim();
        setTitleKeyword(text);
    };

    const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        if (query.hasNextPage && !query.isFetchingNextPage && target.scrollTop + target.clientHeight >= target.scrollHeight - 160) {
            void query.fetchNextPage();
        }
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background text-stone-800 dark:text-stone-100">
            <main
                className="min-h-0 flex-1 overflow-y-auto bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] px-6 py-8 [background-size:16px_16px] dark:bg-[radial-gradient(rgba(245,245,244,.16)_1px,transparent_1px)]"
                onScroll={handleListScroll}
            >
                <div className="pb-8">
                    {/* 页面标题 */}
                    <div className="mx-auto max-w-4xl text-center">
                        <h1 className="text-4xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">画廊</h1>
                        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                            {hasActiveFilters
                                ? `共找到 ${promptItems.length} 幅匹配作品`
                                : `共收录 ${promptItems.length} 幅精选作品，按标题、标签与美学风格快速查找灵感。`}
                        </p>
                    </div>

                    {/* 大气开阔的搜索与筛选控制面板 (扩展至 max-w-6xl) */}
                    <div className="mx-auto mt-8 w-full max-w-6xl space-y-4">
                        <Input.Search
                            size="large"
                            className="w-full text-base"
                            allowClear
                            prefix={<Search className="mr-2 size-4.5 text-stone-400" />}
                            value={titleInput}
                            placeholder="搜索作品标题、风格、标签或提示词 (按 Enter 搜索)"
                            onChange={(event) => {
                                const val = event.target.value;
                                setTitleInput(val);
                                if (!val.trim()) {
                                    setTitleKeyword("");
                                }
                            }}
                            onSearch={(val) => handleSearch(val)}
                        />

                        {/* 筛选卡片区：加大内边距与留白，更显大气开阔 */}
                        <div className="space-y-4 rounded-2xl border border-stone-200/80 bg-white/70 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] backdrop-blur-md dark:border-stone-800/80 dark:bg-stone-900/60 sm:p-6">
                            {/* 分类行：加大字号与胶囊间距，左侧 label 稳健对齐 */}
                            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start">
                                <span className="flex h-[32px] w-12 shrink-0 items-center text-xs font-semibold tracking-wider text-stone-400 uppercase dark:text-stone-500">
                                    分类
                                </span>
                                <div className="flex flex-1 flex-wrap items-center gap-2.5">
                                    {promptCategoryOptions.map((category) => (
                                        <Tag.CheckableTag
                                            key={category}
                                            checked={selectedCategory === category}
                                            className={cn("prompt-filter-tag", selectedCategory === category && "is-active")}
                                            onChange={() => setSelectedCategory(category)}
                                        >
                                            {category}
                                        </Tag.CheckableTag>
                                    ))}
                                </div>
                            </div>

                            {/* 标签行：高度上限提升，多行标签舒发展示，气度更开阔 */}
                            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start">
                                <span className="flex h-[32px] w-12 shrink-0 items-center text-xs font-semibold tracking-wider text-stone-400 uppercase dark:text-stone-500">
                                    标签
                                </span>
                                <div className="thin-scrollbar flex max-h-[160px] flex-1 flex-wrap items-center gap-2.5 overflow-y-auto pr-1">
                                    {promptTagOptions.map((tag) => (
                                        <Tag.CheckableTag
                                            key={tag}
                                            checked={tag === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(tag)}
                                            className={cn("prompt-filter-tag", (tag === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(tag)) && "is-active")}
                                            onChange={() => toggleTag(tag)}
                                        >
                                            {tag}
                                        </Tag.CheckableTag>
                                    ))}
                                </div>
                            </div>

                            {/* 筛选指示与清空全部栏 */}
                            {hasActiveFilters ? (
                                <div className="flex items-center justify-between border-t border-stone-200/60 pt-2.5 dark:border-stone-800/60">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400 dark:text-stone-500">
                                        <span>已应用筛选:</span>
                                        {titleKeyword ? (
                                            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                                                关键词: {titleKeyword}
                                            </span>
                                        ) : null}
                                        {selectedCategory !== ALL_PROMPTS_OPTION ? (
                                            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                                                分类: {selectedCategory}
                                            </span>
                                        ) : null}
                                        {selectedTags.length > 0 ? (
                                            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                                                标签: {selectedTags.join(", ")}
                                            </span>
                                        ) : null}
                                    </div>
                                    <Button
                                        type="link"
                                        size="small"
                                        icon={<RotateCcw className="size-3" />}
                                        onClick={resetAllFilters}
                                        className="h-auto p-0 text-xs font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
                                    >
                                        清空全部筛选
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                {query.isLoading ? (
                    <div className="flex h-60 items-center justify-center">
                        <Spin />
                    </div>
                ) : (
                    <div>
                        <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {promptItems.map((item) => (
                                <PromptCard
                                    key={item.id}
                                    item={item}
                                    onOpen={() => setSelectedPrompt(item)}
                                    onCopy={() => copyText(item.prompt, "提示词已复制")}
                                    extraAction={
                                        <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => savePromptAsset(item)}>
                                            加入我的素材
                                        </Button>
                                    }
                                />
                            ))}
                        </div>

                        {/* 空状态：解除阻塞，提供一键重置筛选按钮 */}
                        {promptItems.length === 0 ? (
                            <div className="mx-auto max-w-md py-16 text-center">
                                <Empty
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    description={
                                        <div className="space-y-1">
                                            <div className="text-base font-medium text-stone-700 dark:text-stone-200">
                                                没有找到匹配的作品
                                            </div>
                                            {hasActiveFilters ? (
                                                <div className="text-xs text-stone-400 dark:text-stone-500">
                                                    当前搜索或筛选组合未匹配到作品，可重置搜索词或清除分类/标签筛选
                                                </div>
                                            ) : (
                                                <div className="text-xs text-stone-400 dark:text-stone-500">
                                                    画廊中暂无公开作品，可在画布中一键发布作品到画廊
                                                </div>
                                            )}
                                        </div>
                                    }
                                >
                                    {hasActiveFilters ? (
                                        <Button
                                            type="primary"
                                            icon={<RotateCcw className="size-3.5" />}
                                            onClick={resetAllFilters}
                                            className="mt-3 font-medium"
                                        >
                                            重置筛选，查看全部作品
                                        </Button>
                                    ) : null}
                                </Empty>
                            </div>
                        ) : null}

                        <div className="mx-auto mt-6 max-w-7xl text-center text-xs text-stone-500 dark:text-stone-400">
                            {query.isFetchingNextPage ? "加载中..." : query.hasNextPage ? "继续向下滚动加载更多" : promptItems.length > 0 ? "已经到底了" : null}
                        </div>
                    </div>
                )}
            </main>

            <PromptDetailDialog prompt={selectedPrompt} onClose={() => setSelectedPrompt(null)} onCopy={(prompt) => copyText(prompt, "提示词已复制")} onSaveAsset={savePromptAsset} />
        </div>
    );
}
