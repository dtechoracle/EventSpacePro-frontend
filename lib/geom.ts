export type Pt = { x: number; y: number };
export type Segment = { start: Pt; end: Pt };

const EPS = 1e-6;

export function almostEqual(a: number, b: number, eps = EPS) {
  return Math.abs(a - b) <= eps;
}

export function dist(a: Pt, b: Pt) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Return intersection point of two segments (p->p2) and (q->q2), or null if none.
// If they touch at endpoints, returns that endpoint (within EPS).
export function segmentIntersection(p: Pt, p2: Pt, q: Pt, q2: Pt): Pt | null {
  // Solve p + t*(p2-p) = q + u*(q2-q)
  const r = { x: p2.x - p.x, y: p2.y - p.y };
  const s = { x: q2.x - q.x, y: q2.y - q.y };
  const rxs = r.x * s.y - r.y * s.x;
  const qmpx = { x: q.x - p.x, y: q.y - p.y };
  const qmpxr = qmpx.x * r.y - qmpx.y * r.x;

  if (almostEqual(rxs, 0) && almostEqual(qmpxr, 0)) {
    // colinear - might overlap
    // For merging, treat colinear overlapping as intersection at endpoints / overlap region
    // We'll return null here (handle overlap separately)
    return null;
  }

  if (almostEqual(rxs, 0) && !almostEqual(qmpxr, 0)) {
    // parallel non-intersecting
    return null;
  }

  const t = (qmpx.x * s.y - qmpx.y * s.x) / rxs;
  const u = (qmpx.x * r.y - qmpx.y * r.x) / rxs;

  if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) {
    return { x: p.x + t * r.x, y: p.y + t * r.y };
  }
  return null;
}

// Check if point p is on segment (a->b)
export function pointOnSegment(p: Pt, a: Pt, b: Pt, eps = 1e-3) {
  const d1 = dist(a, p);
  const d2 = dist(p, b);
  const d = dist(a, b);
  return Math.abs(d - (d1 + d2)) <= eps;
}

// Split a segment at an ordered list of points (must be on the segment). Returns sorted subsegments.
// Points do not include the segment endpoints optionally; function will include them.
export function splitSegmentAtPoints(seg: Segment, pts: Pt[]): Segment[] {
  // Collect endpoints + pts that actually lie on the segment
  const onPts = pts.filter((p) => pointOnSegment(p, seg.start, seg.end));
  // include segment endpoints
  const all = [seg.start, ...onPts, seg.end];
  // remove duplicates by coordinates (within EPS)
  const uniq: Pt[] = [];
  for (const p of all) {
    if (!uniq.some((q) => almostEqual(q.x, p.x) && almostEqual(q.y, p.y))) uniq.push(p);
  }
  // sort points along the segment by parameter t
  const dx = seg.end.x - seg.start.x;
  const dy = seg.end.y - seg.start.y;
  const total = Math.sqrt(dx * dx + dy * dy) || 1;
  const ts = uniq
    .map((p) => ({ p, t: ((p.x - seg.start.x) * dx + (p.y - seg.start.y) * dy) / (total * total) }))
    .sort((a, b) => a.t - b.t)
    .map((x) => x.p);

  const out: Segment[] = [];
  for (let i = 0; i < ts.length - 1; i++) {
    const s = ts[i];
    const e = ts[i + 1];
    if (!almostEqual(s.x, e.x) || !almostEqual(s.y, e.y)) {
      out.push({ start: s, end: e });
    }
  }
  return out;
}

