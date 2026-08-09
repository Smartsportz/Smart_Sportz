import { useEffect } from "react";

export function useWheelHorizontal(selector = ".wheel-horizontal") {
  useEffect(() => {
    const rails = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const cleanups = rails.map((rail) => {
      const handleWheel = (event: WheelEvent) => {
        const canScroll = rail.scrollWidth > rail.clientWidth;
        if (!canScroll) return;
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        if (delta === 0) return;
        const atStart = rail.scrollLeft <= 1;
        const atEnd = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 1;
        const goingLeft = delta < 0;
        const goingRight = delta > 0;
        if ((goingLeft && atStart) || (goingRight && atEnd)) return;
        event.preventDefault();
        rail.scrollLeft += delta * 1.18;
      };
      rail.addEventListener("wheel", handleWheel, { passive: false });
      return () => rail.removeEventListener("wheel", handleWheel);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [selector]);
}
