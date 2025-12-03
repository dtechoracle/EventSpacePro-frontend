import React from "react";

type Props = {
  widthPx: number;
  strokePx: number;
  onEndDragStart: (e: React.MouseEvent, which: "start" | "end") => void;
  onRotateStart: (e: React.MouseEvent) => void;
};

export default function LineHandlesRenderer({ widthPx, strokePx, onEndDragStart, onRotateStart }: Props) {
  const knob: React.CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#000",
    border: "2px solid #fff",
  };

  return (
    <>
      {/* Start/end knobs positioned along the line's local axis */}
      <div
        onMouseDown={(e) => onEndDragStart(e, "start")}
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translate(-50%, -50%)",
          cursor: "ew-resize",
          ...knob,
        }}
      />
      <div
        onMouseDown={(e) => onEndDragStart(e, "end")}
        style={{
          position: "absolute",
          right: 0,
          top: "50%",
          transform: "translate(50%, -50%)",
          cursor: "ew-resize",
          ...knob,
        }}
      />
      {/* Rotation knob */}
      <div
        onMouseDown={onRotateStart}
        style={{
          position: "absolute",
          left: "50%",
          top: -16 - strokePx,
          transform: "translate(-50%, -50%)",
          cursor: "grab",
          ...knob,
        }}
      />
    </>
  );
}




