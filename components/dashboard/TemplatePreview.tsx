import React, { useMemo, useRef, useState, useEffect, useTransition } from "react";
import WorkspacePreview from "@/components/WorkspacePreview";
import { buildPreviewData } from "@/helpers/previewHelpers";

export default function TemplatePreview({ items }: { items: any[] }) {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    startTransition(() => {
                        setIsVisible(true);
                    });
                    observer.disconnect();
                }
            },
            { rootMargin: "200px" }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const { walls, shapes, assets, textAnnotations } = useMemo(() => {
        if (!isVisible) return { walls: [], shapes: [], assets: [], textAnnotations: [] };
        const fakeEvent = { canvasAssets: items };
        return buildPreviewData(fakeEvent);
    }, [items, isVisible]);

    return (
        <div ref={ref} className="w-full h-full relative">
            {/* Skeleton always visible underneath */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 animate-pulse" />

            {/* Preview fades in when ready */}
            <div className={`absolute inset-0 transition-opacity duration-500 ${isVisible && !isPending ? 'opacity-100' : 'opacity-0'}`}>
                <WorkspacePreview
                    walls={walls}
                    shapes={shapes}
                    assets={assets}
                    textAnnotations={textAnnotations}
                    width={480}
                    height={180}
                    backgroundColor="#ffffff"
                />
            </div>
        </div>
    );
}
