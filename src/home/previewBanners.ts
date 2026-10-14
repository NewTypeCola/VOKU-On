import { preview } from "../community/preview";
import { canManageBoard } from "../community/types";
import { MAX_HOME_BANNERS, type BannerInput, type BannerRecord, type ResolvedBanner } from "./banner";

const key = "voku-home-banner-preview-v1";
const rows = (): BannerRecord[] => JSON.parse(localStorage.getItem(key) || "[]");
function admin() {
  if (preview.profile()?.role !== "admin" || !canManageBoard(preview.profile())) throw Error("홈 배너는 관리자만 관리할 수 있습니다.");
}
export const previewBanners = {
  async read(manage: boolean): Promise<ResolvedBanner[]> {
    if (manage) admin();
    return rows().filter(row => manage || row.enabled).sort((a,b) => a.position-b.position).map(row => ({ ...row, src: row.imagePath }));
  },
  async action(action: string, payload: BannerInput | Record<string, unknown>) {
    admin();
    let list = rows();
    const p = payload as BannerInput;
    const old = list.find(row => row.id === p.id);
    if (p.id && (!old || old.version !== p.version)) throw Error("다른 화면에서 배너가 변경되었습니다. 새로 불러온 뒤 다시 시도해 주세요.");
    if (action === "remove") list = list.filter(row => row.id !== p.id);
    else if (action === "reorder") {
      const order = (payload as { order: Pick<BannerRecord,"id"|"version">[] }).order;
      if (order.length !== list.length || new Set(order.map(row => row.id)).size !== list.length || order.some(row => !list.some(item => item.id === row.id && item.version === row.version)))
        throw Error("다른 화면에서 배너가 변경되었습니다. 새로 불러온 뒤 다시 시도해 주세요.");
      list = order.map((row,index) => ({ ...list.find(item => item.id === row.id)!, position: index+1, version: row.version+1 }));
    } else {
      if (!old && list.length >= MAX_HOME_BANNERS) throw Error("배너는 최대 10개까지 등록할 수 있습니다.");
      const next = { ...p, id: old?.id || crypto.randomUUID(), position: old?.position || list.length+1, version: (old?.version || 0)+1 } as BannerRecord;
      list = old ? list.map(row => row.id === old.id ? next : row) : [...list,next];
    }
    localStorage.setItem(key, JSON.stringify(list));
  },
};
