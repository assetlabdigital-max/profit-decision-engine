import React from "react";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--accent)",
        fontWeight: 600,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}
