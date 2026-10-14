// Small, inert facade. The collector runtime is loaded after the app renders.
export type UsageData = {
  record?: string;
  entity?: string;
  page?: number;
  value?: number;
  detail?: string;
  sample?: boolean;
};
type Sink = {
  event(name: string, data?: UsageData): void;
  navigate(path: string): void;
  reading(record: string, page: number): void;
};
let sink: Sink | undefined;
let path = "/home";
let reading: [string, number] = ["", 0];
const pending: [string, UsageData?][] = [];
export function usage(name: string, data?: UsageData) {
  if (sink) sink.event(name, data);
  else if (pending.length < 20) pending.push([name, data]);
}
export function usageRoute(next: string) {
  path = next;
  sink?.navigate(next);
  sink?.reading(...reading);
}
export function usageReading(record: string, page: number) {
  reading = [record, page];
  sink?.reading(record, page);
}
export function connectUsage(next: Sink) {
  sink = next;
  next.navigate(path);
  next.reading(...reading);
  for (const args of pending.splice(0)) next.event(...args);
}
