import type { ReviewMarker } from "./types";

export interface MarkerCluster {
  atMs: number;
  markers: ReviewMarker[];
}

/**
 * Groups markers that fall within `thresholdFraction` of the recording's
 * duration of each other, so close-together events read as one compact mark
 * on the playback bar instead of an illegible pile-up.
 */
export function clusterMarkers(markers: ReviewMarker[], durationMs: number, thresholdFraction = 0.015): MarkerCluster[] {
  if (markers.length === 0) return [];
  const thresholdMs = durationMs * thresholdFraction;
  const sorted = [...markers].sort((a, b) => a.atMs - b.atMs);
  const clusters: MarkerCluster[] = [{ atMs: sorted[0].atMs, markers: [sorted[0]] }];

  for (let i = 1; i < sorted.length; i++) {
    const marker = sorted[i];
    const current = clusters[clusters.length - 1];
    if (marker.atMs - current.markers[current.markers.length - 1].atMs <= thresholdMs) {
      current.markers.push(marker);
      current.atMs = current.markers.reduce((sum, m) => sum + m.atMs, 0) / current.markers.length;
    } else {
      clusters.push({ atMs: marker.atMs, markers: [marker] });
    }
  }
  return clusters;
}
