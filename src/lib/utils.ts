import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 嘗試把縮圖 URL 換成更高解析度版本。各 source 有不同規則。
 */
export function upgradeImageUrl(url: string, source: string): string {
  if (!url) return url;
  if (source === 'Jable') {
    return url.replace(/\/320x180\/\d+\.jpg$/, '/preview.jpg');
  }
  if (source === 'MissAV') {
    return url.replace('cover-t.jpg', 'cover-n.jpg');
  }
  if (source === 'Javrate') {
    return url.replace('_thumbnail.webp', '.webp');
  }
  if (source === 'SupJav') {
    // `!320x216.jpg` 之類的後綴是縮圖參數，去掉即全尺寸
    return url.replace(/!\d+x\d+\.jpg$/, '');
  }
  return url;
}
