import React, { useEffect, useRef, useState } from "react";

type LogsProps = {
  lines: string[];
};

export default function Logs({ lines }: LogsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [userInteracting, setUserInteracting] = useState(false);
  const interactionTimeout = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom if auto-scroll is allowed
  useEffect(() => {
    if (!userInteracting && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, userInteracting]);

  // Handler to stop auto-scroll when user interacts
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleUserInteraction = () => {
      setUserInteracting(true);

      // Clear old timeout if exists
      if (interactionTimeout.current) {
        clearTimeout(interactionTimeout.current);
      }

      // Restart auto-scroll 5 sec after last interaction
      interactionTimeout.current = setTimeout(() => {
        setUserInteracting(false);
      }, 5000);
    };

    container.addEventListener("scroll", handleUserInteraction);
    container.addEventListener("wheel", handleUserInteraction);
    container.addEventListener("touchmove", handleUserInteraction);

    return () => {
      container.removeEventListener("scroll", handleUserInteraction);
      container.removeEventListener("wheel", handleUserInteraction);
      container.removeEventListener("touchmove", handleUserInteraction);
      if (interactionTimeout.current) {
        clearTimeout(interactionTimeout.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-48 w-full overflow-y-auto bg-custom_black p-2 rounded border"
    >
      {lines.map((line, i) => (
        <div
          key={i}
          className="text-xs font-mono text-white whitespace-pre-wrap"
        >
          {line}
        </div>
      ))}
    </div>
  );
}
