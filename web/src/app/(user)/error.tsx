"use client";

import { useEffect } from "react";
import { Button } from "antd";
import { RefreshCw, RotateCcw } from "lucide-react";

export default function UserError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        const msg = error?.message || "";
        const isDeploymentSkew =
            msg.includes("Failed to find Server Action") ||
            msg.includes("Loading chunk") ||
            msg.includes("ChunkLoadError") ||
            msg.includes("Invariant: The client reference manifest");

        if (isDeploymentSkew && typeof window !== "undefined") {
            const lastReload = sessionStorage.getItem("canvas_last_auto_reload");
            const now = Date.now();
            if (!lastReload || now - Number(lastReload) > 10000) {
                sessionStorage.setItem("canvas_last_auto_reload", String(now));
                window.location.reload();
            }
        }
    }, [error]);

    const handleReload = () => {
        if (typeof window !== "undefined") {
            window.location.reload();
        } else {
            reset();
        }
    };

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                ⚡
            </div>
            <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">页面加载异常或检测到新版本</h2>
            <p className="mt-2 max-w-md text-sm text-stone-500 dark:text-stone-400">
                代码或依赖资源已同步更新，点击下方刷新按钮即可载入最新页面内容。
            </p>
            <div className="mt-6 flex items-center gap-3">
                <Button type="primary" icon={<RefreshCw className="size-4" />} onClick={handleReload}>
                    刷新并重新加载
                </Button>
                <Button icon={<RotateCcw className="size-4" />} onClick={() => reset()}>
                    重试当前组件
                </Button>
            </div>
        </div>
    );
}
