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
  
  let finalUrl = url;
  if (source === 'Jable') {
    finalUrl = url.replace(/\/320x180\/\d+\.jpg$/, '/preview.jpg');
  } else if (source === 'MissAV') {
    finalUrl = url.replace('cover-t.jpg', 'cover-n.jpg');
  } else if (source === 'Javrate') {
    finalUrl = url.replace('_thumbnail.webp', '.webp');
  } else if (source === 'SupJav') {
    // `!320x216.jpg` 之類的後綴是縮圖參數，去掉即全尺寸
    finalUrl = url.replace(/!\d+x\d+\.jpg$/, '');
  }
  
  // 為了避免 Vercel IP 被擋或缺少 Referer 導致 403，統一透過我們自己寫的 proxy 轉發
  return `/api/image-proxy?url=${encodeURIComponent(finalUrl)}`;
}
