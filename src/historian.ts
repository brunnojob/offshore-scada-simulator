export type HistoryPoint = {
  tag: string;
  value: number;
  timestamp: number;
  quality: string;
};
export type Bucket = {
  start: number;
  count: number;
  min: number;
  max: number;
  mean: number;
  last: number;
};
export class Historian {
  private readonly points = new Map<string, HistoryPoint[]>();
  constructor(
    private readonly capacity = 10000,
    private readonly retentionMs = 86400000,
  ) {
    if (!Number.isInteger(capacity) || capacity < 1 || retentionMs < 1)
      throw new Error("invalid_retention");
  }
  append(point: HistoryPoint, now = Date.now()) {
    if (
      !point.tag ||
      !Number.isFinite(point.value) ||
      !Number.isSafeInteger(point.timestamp) ||
      point.timestamp > now + 5000 ||
      now - point.timestamp > this.retentionMs
    )
      throw new Error("invalid_history_point");
    if (!this.points.has(point.tag) && this.points.size >= 1024)
      throw new Error("tag_capacity_reached");
    let rows = this.points.get(point.tag) ?? [];
    if (rows.length && rows[rows.length - 1].timestamp >= point.timestamp)
      throw new Error("history_timestamp_regressed");
    rows.push({ ...point });
    rows = rows.filter((row) => row.timestamp >= now - this.retentionMs);
    if (rows.length > this.capacity)
      rows.splice(0, rows.length - this.capacity);
    this.points.set(point.tag, rows);
  }
  query(tag: string, from: number, to: number, intervalMs = 60000): Bucket[] {
    if (
      !Number.isSafeInteger(from) ||
      !Number.isSafeInteger(to) ||
      from > to ||
      !Number.isSafeInteger(intervalMs) ||
      intervalMs < 1 ||
      (to - from) / intervalMs > 10000
    )
      throw new Error("invalid_history_range");
    const buckets = new Map<number, Bucket>();
    for (const point of this.points.get(tag) ?? []) {
      if (
        point.timestamp < from ||
        point.timestamp > to ||
        point.quality !== "good"
      )
        continue;
      const start =
        from + Math.floor((point.timestamp - from) / intervalMs) * intervalMs;
      const bucket = buckets.get(start);
      if (!bucket)
        buckets.set(start, {
          start,
          count: 1,
          min: point.value,
          max: point.value,
          mean: point.value,
          last: point.value,
        });
      else {
        bucket.count++;
        bucket.mean += (point.value - bucket.mean) / bucket.count;
        bucket.min = Math.min(bucket.min, point.value);
        bucket.max = Math.max(bucket.max, point.value);
        bucket.last = point.value;
      }
    }
    return [...buckets.values()]
      .sort((a, b) => a.start - b.start)
      .map((bucket) => ({ ...bucket }));
  }
}
