import { useEffect, useRef } from "react";
import { useProjectStore } from "@/store/projectStore";
import toast from "react-hot-toast";

export function useUnsavedChangesGuard() {
  const hasUnsavedChanges = useProjectStore((s) => s.hasUnsavedChanges);
  const prevRef = useRef(hasUnsavedChanges);

  useEffect(() => {
    if (hasUnsavedChanges && !prevRef.current) {
      toast("You have unsaved changes", { id: "unsaved", duration: 4000 });
    }
    if (!hasUnsavedChanges && prevRef.current) {
      toast.dismiss("unsaved");
    }
    prevRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
