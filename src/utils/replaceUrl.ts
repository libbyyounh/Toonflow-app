import path from "node:path";

export default function replaceUrl(url: string): string {
    if (typeof url !== 'string' || !url.trim()) return '';
    let cleanedPath = '';
    try {
        cleanedPath = new URL(url).pathname;
    } catch (e) {
        // 如果不是有效的URL，则直接使用原字符串
        cleanedPath = url;
    }

    cleanedPath = cleanedPath.replace(/^\/+/, '');
    // 兼容完整 URL 和相对路径两种输入，统一剥离静态访问前缀。
    while (
        cleanedPath === 'oss' ||
        cleanedPath === 'smallImage' ||
        cleanedPath.startsWith('oss/') ||
        cleanedPath.startsWith('smallImage/')
    ) {
        cleanedPath = cleanedPath.replace(/^(oss|smallImage)(\/|$)/, '');
    }

    // 防止路径穿越：对路径进行规范化后，确保不含上溯分量
    // 使用 posix 规范化（保持 / 分隔符），去除所有 .. 和 .
    const normalized = path.posix.normalize(cleanedPath);

  // 去除前导斜杠，保证返回的是相对路径
  return normalized.replace(/^\/+/, "");
}
