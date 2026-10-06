"use client";

import { useEffect } from "react";

export default function GlobalError({
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

    const handleHardReload = () => {
        if (typeof window !== "undefined") {
            window.location.href = window.location.href;
        } else {
            reset();
        }
    };

    return (
        <html lang="zh-CN">
            <body className="flex min-h-screen items-center justify-center bg-stone-50 p-4 font-sans text-stone-900 antialiased dark:bg-stone-950 dark:text-stone-100">
                <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-lg dark:border-stone-800 dark:bg-stone-900">
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                        ⚡
                    </div>
                    <h2 className="text-xl font-semibold">服务已更新或页面需要刷新</h2>
                    <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                        检测到系统有新版本发布或资源已更新，请点击下方按钮刷新加载最新版本。
                    </p>
                    <div className="mt-6 flex justify-center gap-3">
                        <button
                            type="button"
                            onClick={handleHardReload}
                            className="inline-flex h-10 items-center justify-center rounded-xl bg-stone-900 px-5 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
                        >
                            刷新页面
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (typeof window !== "undefined") {
                                    window.location.href = "/";
                                }
                            }}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-200 px-5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-800 dark:text-stone-300 dark:hover:bg-stone-800"
                        >
                            返回首页
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
