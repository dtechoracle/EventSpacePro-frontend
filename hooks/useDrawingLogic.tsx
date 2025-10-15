import { useCallback } from "react";

export function useDrawingLogic() {
  // Function to straighten a path if it's close to being a straight line
  const straightenPath = useCallback((path: { x: number; y: number }[]) => {
    if (path.length < 3) return path;
    
    const startPoint = path[0];
    const endPoint = path[path.length - 1];
    
    // Calculate straight-line distance
    const straightDistance = Math.sqrt(
      Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2)
    );
    
    // Calculate actual path distance
    let actualDistance = 0;
    for (let i = 1; i < path.length; i++) {
      const segmentDistance = Math.sqrt(
        Math.pow(path[i].x - path[i-1].x, 2) + Math.pow(path[i].y - path[i-1].y, 2)
      );
      actualDistance += segmentDistance;
    }
    
    // Calculate straightness ratio (1.0 = perfectly straight)
    const straightnessRatio = straightDistance / actualDistance;
    
    // If the path is close to straight (ratio > 0.85), straighten it
    if (straightnessRatio > 0.85) {
      // Create a straight line with multiple points for smooth rendering
      const numPoints = Math.max(3, Math.ceil(straightDistance / 5)); // 1 point per 5mm
      const straightenedPath: { x: number; y: number }[] = [];
      
      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const x = startPoint.x + (endPoint.x - startPoint.x) * t;
        const y = startPoint.y + (endPoint.y - startPoint.y) * t;
        straightenedPath.push({ x, y });
      }
      
      return straightenedPath;
    }
    
    // If not straight enough, return original path
    return path;
  }, []);

  return { straightenPath };
}
