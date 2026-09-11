// 素材图片存储（Supabase Storage）删除助手
// 素材上传时图片落在 bucket 的 material/ 目录下，删除素材时连带清理，避免存储桶堆积孤儿文件。
const { supabaseAdmin } = require('./supabase');

const BUCKET = process.env.SUPABASE_PIC_BUCKET || 'foubow_pic';

/**
 * 从 Supabase 图片 publicUrl 解析出对象路径。
 * 例：https://xxx.supabase.co/storage/v1/object/public/foubow_pic/material/abc.png
 *  → material/abc.png
 * 非本桶 / 非本项目的图片返回 null（外部 URL 不处理）。
 * @param {string} imageUrl
 * @returns {string|null}
 */
function parseObjectPath(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const m = imageUrl.match(/\/foubow_pic\/(.+?)(?:\?.*)?$/);
  if (!m) return null;
  return decodeURIComponent(m[1]).replace(/^\/+/, '');
}

/**
 * 删除 Supabase 存储桶中的图片（best-effort，调用方自行决定是否忽略结果）。
 * @param {string} imageUrl 图片 publicUrl 或对象路径
 * @returns {Promise<{deleted:boolean, path?:string, reason?:string}>}
 */
async function deleteSupabaseImage(imageUrl) {
  const objectPath = parseObjectPath(imageUrl);
  if (!objectPath) {
    return { deleted: false, reason: 'not_a_supabase_pic_url' };
  }
  if (!supabaseAdmin) {
    return { deleted: false, reason: 'supabase_admin_unavailable' };
  }
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([objectPath]);
    if (error) {
      return { deleted: false, reason: error.message, path: objectPath };
    }
    return { deleted: true, path: objectPath, data };
  } catch (e) {
    return { deleted: false, reason: e.message, path: objectPath };
  }
}

module.exports = { BUCKET, parseObjectPath, deleteSupabaseImage };
