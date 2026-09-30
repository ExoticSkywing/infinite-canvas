"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { App, Button, Empty, Input, Modal, Pagination, Spin, Tabs, Tag } from "antd";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAssetStore, type Asset } from "@/stores/use-asset-store";
import { fetchAssetLibrary, type AssetLibraryItem } from "@/services/api/assets";
import { AssetFormModal } from "@/components/assets/asset-form-modal";
import type { InsertAssetPayload } from "../types";

export type { InsertAssetPayload } from "../types";

export type AssetPickerTab = "my-assets" | "library";

type Props = {
    open: boolean;
    defaultTab?: AssetPickerTab;
    onInsert: (payload: InsertAssetPayload) => void;
    onClose: () => void;
};

export function AssetPickerModal({ open, defaultTab = "my-assets", onInsert, onClose }: Props) {
    const [activeTab, setActiveTab] = useState<AssetPickerTab>(defaultTab);

    useEffect(() => {
        if (open) setActiveTab(defaultTab);
    }, [open, defaultTab]);

    return (
        <Modal title="选择素材" open={open} onCancel={onClose} footer={null} width={860} destroyOnHidden styles={{ body: { padding: "0 24px 24px", minHeight: 480 } }}>
            <Tabs
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as AssetPickerTab)}
                items={[
                    { key: "my-assets", label: "我的素材", children: <MyAssetsTab onInsert={onInsert} /> },
                    { key: "library", label: "素材库", children: <LibraryTab onInsert={onInsert} /> },
                ]}
            />
        </Modal>
    );
}

const PAGE_SIZE = 8;

const kindOptions = [
    { label: "全部", value: "all" },
    { label: "文本", value: "text" },
    { label: "图片", value: "image" },
    { label: "视频", value: "video" },
    { label: "音频", value: "audio" },
];

function LibraryTab({ onInsert }: { onInsert: (payload: InsertAssetPayload) => void }) {
    const { message } = App.useApp();
    const [keyword, setKeyword] = useState("");
    const [kindFilter, setKindFilter] = useState("");
    const [page, setPage] = useState(1);
    const [inserting, setInserting] = useState<string | null>(null);

    const query = useQuery({
        queryKey: ["asset-picker-library", keyword, kindFilter, page],
        queryFn: () => fetchAssetLibrary({ keyword, type: kindFilter, page, pageSize: PAGE_SIZE }),
        retry: false,
    });

    const items = query.data?.items || [];
    const total = query.data?.total || 0;

    const handleInsert = async (asset: AssetLibraryItem) => {
        try {
            setInserting(asset.id);
            if (asset.type === "text") {
                onInsert({ kind: "text", content: asset.content, title: asset.title, source: "library" });
            } else if (asset.type === "video") {
                onInsert({ kind: "video", url: asset.url, title: asset.title, source: "library" });
            } else if (asset.type === "audio") {
                onInsert({ kind: "audio", url: asset.url, title: asset.title, source: "library" });
            } else {
                onInsert({ kind: "image", dataUrl: asset.url, title: asset.title, source: "library" });
            }
        } catch {
            message.error("插入失败");
        } finally {
            setInserting(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <Input
                    className="w-56"
                    size="small"
                    prefix={<Search className="size-3.5 text-stone-400" />}
                    placeholder="搜索素材"
                    value={keyword}
                    allowClear
                    onChange={(e) => {
                        setPage(1);
                        setKeyword(e.target.value);
                    }}
                />
                <div className="flex gap-1.5">
                    {[
                        { label: "全部", value: "" },
                        { label: "文本", value: "text" },
                        { label: "图片", value: "image" },
                        { label: "视频", value: "video" },
                        { label: "音频", value: "audio" },
                    ].map((opt) => (
                        <Tag.CheckableTag
                            key={opt.value || "all"}
                            checked={kindFilter === opt.value}
                            className={cn("prompt-filter-tag", kindFilter === opt.value && "is-active")}
                            onChange={() => {
                                setPage(1);
                                setKindFilter(opt.value);
                            }}
                        >
                            {opt.label}
                        </Tag.CheckableTag>
                    ))}
                </div>
            </div>

            {query.isLoading ? (
                <div className="flex justify-center py-16">
                    <Spin />
                </div>
            ) : items.length ? (
                <div className="grid grid-cols-4 gap-3">
                    {items.map((asset) => (
                        <PickerCard key={asset.id} title={asset.title} kind={asset.type} cover={asset.coverUrl} loading={inserting === asset.id} onClick={() => void handleInsert(asset)} />
                    ))}
                </div>
            ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有素材" className="py-12" />
            )}

            {total > PAGE_SIZE && (
                <div className="flex justify-center">
                    <Pagination size="small" current={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} showSizeChanger={false} />
                </div>
            )}
        </div>
    );
}

function PickerCard({
    title,
    kind,
    cover,
    loading,
    onClick,
    onEdit,
    onDelete,
}: {
    title: string;
    kind: string;
    cover: string;
    loading?: boolean;
    onClick: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}) {
    return (
        <div
            role="button"
            tabIndex={0}
            className="group relative cursor-pointer overflow-hidden rounded-lg border border-stone-200 bg-white text-left transition hover:border-stone-400 hover:shadow-md dark:border-stone-700 dark:bg-stone-900 dark:hover:border-stone-500"
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick();
                }
            }}
        >
            {cover ? (
                <img src={cover} alt={title} className="aspect-[4/3] w-full object-cover" />
            ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 p-3 text-center text-xs leading-5 text-stone-500 dark:bg-stone-800 dark:text-stone-400">{title}</div>
            )}
            <div className="p-2.5">
                <div className="flex items-center justify-between gap-2">
                    <span className="line-clamp-1 text-xs font-medium text-stone-800 dark:text-stone-200">{title}</span>
                    <Tag className="m-0 shrink-0 text-[10px]">{kind === "image" ? "图片" : kind === "video" ? "视频" : kind === "audio" ? "音频" : "文本"}</Tag>
                </div>
            </div>
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-stone-900/60">
                    <Spin size="small" />
                </div>
            )}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-950/0 text-sm font-medium text-white opacity-0 transition group-hover:bg-stone-950/55 group-hover:opacity-100">
                插入
            </div>
            {(onEdit || onDelete) ? (
                <div
                    className="absolute right-1.5 top-1.5 z-20 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                >
                    {onEdit ? (
                        <button
                            type="button"
                            title="编辑素材"
                            className="flex size-6 items-center justify-center rounded-md border border-stone-200/90 bg-white/90 text-stone-600 shadow-sm backdrop-blur-sm transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900 dark:border-stone-700/80 dark:bg-stone-800/90 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:bg-stone-700 dark:hover:text-white"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onEdit();
                            }}
                        >
                            <Pencil className="size-3" />
                        </button>
                    ) : null}
                    {onDelete ? (
                        <button
                            type="button"
                            title="删除素材"
                            className="flex size-6 items-center justify-center rounded-md border border-stone-200/90 bg-white/90 text-stone-600 shadow-sm backdrop-blur-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-stone-700/80 dark:bg-stone-800/90 dark:text-stone-300 dark:hover:border-red-900/50 dark:hover:bg-red-950/60 dark:hover:text-red-400"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onDelete();
                            }}
                        >
                            <Trash2 className="size-3" />
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

function MyAssetsTab({ onInsert }: { onInsert: (payload: InsertAssetPayload) => void }) {
    const { modal, message } = App.useApp();
    const assets = useAssetStore((state) => state.assets);
    const removeAsset = useAssetStore((state) => state.removeAsset);
    const [keyword, setKeyword] = useState("");
    const [kindFilter, setKindFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [formOpen, setFormOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

    const filtered = useMemo(() => {
        const query = keyword.trim().toLowerCase();
        return assets
            .filter((a) => a.kind === "text" || a.kind === "image" || a.kind === "video" || a.kind === "audio")
            .filter((a) => kindFilter === "all" || a.kind === kindFilter)
            .filter((a) => !query || [a.title, ...(a.tags || [])].join(" ").toLowerCase().includes(query));
    }, [assets, keyword, kindFilter]);

    const visible = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        setPage((v) => Math.min(v, maxPage));
    }, [filtered.length]);

    const handleInsert = (asset: Asset) => {
        if (asset.kind === "text") {
            onInsert({ kind: "text", content: asset.data.content, title: asset.title, assetId: asset.id, source: "asset" });
        } else {
            onInsert(
                asset.kind === "video"
                    ? { kind: "video", url: asset.data.url, storageKey: asset.data.storageKey, title: asset.title, assetId: asset.id, width: asset.data.width, height: asset.data.height, bytes: asset.data.bytes, mimeType: asset.data.mimeType, source: "asset" }
                    : asset.kind === "audio"
                      ? { kind: "audio", url: asset.data.url, storageKey: asset.data.storageKey, title: asset.title, assetId: asset.id, bytes: asset.data.bytes, mimeType: asset.data.mimeType, durationMs: asset.data.durationMs, source: "asset" }
                      : { kind: "image", dataUrl: asset.data.dataUrl, storageKey: asset.data.storageKey, title: asset.title, assetId: asset.id, width: asset.data.width, height: asset.data.height, bytes: asset.data.bytes, mimeType: asset.data.mimeType, source: "asset" },
            );
        }
    };

    const handleDelete = (asset: Asset) => {
        modal.confirm({
            title: "删除素材",
            content: `确定删除「${asset.title || "未命名素材"}」吗？删除后会从我的素材中移除。`,
            okText: "删除",
            okType: "danger",
            cancelText: "取消",
            centered: true,
            onOk: () => {
                removeAsset(asset.id);
                message.success("素材已删除");
            },
        });
    };

    const handleOpenAdd = () => {
        setEditingAsset(null);
        setFormOpen(true);
    };

    const handleOpenEdit = (asset: Asset) => {
        setEditingAsset(asset);
        setFormOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <Input
                        className="w-56"
                        size="small"
                        prefix={<Search className="size-3.5 text-stone-400" />}
                        placeholder="搜索素材"
                        value={keyword}
                        allowClear
                        onChange={(e) => {
                            setPage(1);
                            setKeyword(e.target.value);
                        }}
                    />
                    <div className="flex gap-1.5">
                        {kindOptions.map((opt) => (
                            <Tag.CheckableTag
                                key={opt.value}
                                checked={kindFilter === opt.value}
                                className={cn("prompt-filter-tag", kindFilter === opt.value && "is-active")}
                                onChange={() => {
                                    setPage(1);
                                    setKindFilter(opt.value);
                                }}
                            >
                                {opt.label}
                            </Tag.CheckableTag>
                        ))}
                    </div>
                </div>
                <Button size="small" icon={<Plus className="size-3.5" />} onClick={handleOpenAdd}>
                    新增素材
                </Button>
            </div>

            {visible.length ? (
                <div className="grid grid-cols-4 gap-3">
                    {visible.map((asset) => (
                        <PickerCard
                            key={asset.id}
                            title={asset.title}
                            kind={asset.kind}
                            cover={asset.coverUrl || (asset.kind === "image" ? asset.data.dataUrl : "")}
                            onClick={() => handleInsert(asset)}
                            onEdit={() => handleOpenEdit(asset)}
                            onDelete={() => handleDelete(asset)}
                        />
                    ))}
                </div>
            ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有素材" className="py-12" />
            )}

            {filtered.length > PAGE_SIZE && (
                <div className="flex justify-center">
                    <Pagination size="small" current={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} showSizeChanger={false} />
                </div>
            )}

            <AssetFormModal
                open={formOpen}
                asset={editingAsset}
                onClose={() => {
                    setFormOpen(false);
                    setEditingAsset(null);
                }}
            />
        </div>
    );
}
