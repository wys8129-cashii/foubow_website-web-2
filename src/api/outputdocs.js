// 产出物（Output Docs）数据层
// 文档存 output_docs，块存 output_doc_items；所有访问走 supabaseAdmin（service_role 绕过 RLS）。
// 读取时把 DB 行映射回前端 shape：
//   doc = { id, title, type, createdAt(ms), items:[{kind,level,value,payload}, ...] }
//   fullState = { "<collection>": [doc, ...], ... }

const { supabaseAdmin } = require('./supabase');

const DOCS = 'output_docs';
const ITEMS = 'output_doc_items';

// 把单行 item 映射回前端结构
function rowToItem(it) {
  return {
    kind: it.kind === 'ref' ? 'ref' : 'text',
    level: typeof it.level === 'number' ? it.level : 0,
    value: it.kind === 'ref' ? (it.value || '') : (it.value == null ? '' : it.value),
    payload: it.kind === 'ref' ? (it.payload || null) : null,
  };
}

// 取某文档的全部块（按 seq 升序）
async function _getItems(userId, docId) {
  const { data, error } = await supabaseAdmin
    .from(ITEMS)
    .select('*')
    .eq('doc_id', docId)
    .eq('user_id', userId)
    .order('seq', { ascending: true });
  if (error) throw new Error('读取块失败: ' + error.message);
  return (data || []).map(rowToItem);
}

// 用前端 items 数组全量覆盖某文档的块（先删后插，seq 即数组下标）
async function _saveItems(userId, docId, items) {
  await supabaseAdmin.from(ITEMS).delete().eq('doc_id', docId).eq('user_id', userId);
  if (!items || !items.length) return;
  const rows = items.map((it, i) => ({
    doc_id: docId,
    user_id: userId,
    seq: i,
    kind: it.kind === 'ref' ? 'ref' : 'text',
    level: typeof it.level === 'number' ? it.level : 0,
    value: it.kind === 'ref' ? null : (it.value == null ? '' : String(it.value)),
    payload: it.kind === 'ref' ? (it.payload || null) : null,
  }));
  const { error } = await supabaseAdmin.from(ITEMS).insert(rows);
  if (error) throw new Error('保存块失败: ' + error.message);
}

// 取完整 state map：{ "<collection>": [doc,...] }
async function getFullState(userId) {
  const { data: docs, error } = await supabaseAdmin
    .from(DOCS)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error('查询文档失败: ' + error.message);

  const ids = (docs || []).map((d) => d.id);
  const itemsMap = {};
  if (ids.length) {
    const { data: items, error: ie } = await supabaseAdmin
      .from(ITEMS)
      .select('*')
      .in('doc_id', ids)
      .order('seq', { ascending: true });
    if (ie) throw new Error('查询块失败: ' + ie.message);
    (items || []).forEach((it) => {
      (itemsMap[it.doc_id] = itemsMap[it.doc_id] || []).push(rowToItem(it));
    });
  }

  const map = {};
  (docs || []).forEach((d) => {
    (map[d.collection_name] = map[d.collection_name] || []).push({
      id: d.id,
      title: d.title,
      type: d.type,
      createdAt: new Date(d.created_at).getTime(),
      items: itemsMap[d.id] || [],
    });
  });
  return map;
}

// 取单个合集的文档数组
async function getCollection(userId, collection) {
  const map = await getFullState(userId);
  return map[collection] || [];
}

function newDocId() {
  return 'doc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 新建文档（upsert，docId 由前端生成，幂等）
async function createDoc({ userId, collection, title, type, items, id }) {
  const docId = (id && typeof id === 'string' && id.length) ? id : newDocId();
  const now = new Date().toISOString();
  const docRow = {
    id: docId,
    user_id: userId,
    collection_name: collection,
    title: title || '未命名文档',
    type: type === 'ol' ? 'ol' : 'ul',
    created_at: now,
    updated_at: now,
  };
  const { error } = await supabaseAdmin
    .from(DOCS)
    .upsert(docRow, { onConflict: 'user_id,id' });
  if (error) throw new Error('创建文档失败: ' + error.message);
  await _saveItems(userId, docId, items || []);
  return {
    id: docId,
    title: docRow.title,
    type: docRow.type,
    createdAt: new Date(now).getTime(),
    items: items || [],
  };
}

// 整篇覆盖：title/type/items（items 全量）
async function updateDocFull({ userId, docId, title, type, items }) {
  const patch = { updated_at: new Date().toISOString() };
  if (title !== undefined) patch.title = title;
  if (type !== undefined) patch.type = type === 'ol' ? 'ol' : 'ul';
  const { error } = await supabaseAdmin
    .from(DOCS)
    .update(patch)
    .eq('user_id', userId)
    .eq('id', docId);
  if (error) throw new Error('更新文档失败: ' + error.message);
  if (items !== undefined) await _saveItems(userId, docId, items);
  return getDoc(userId, docId);
}

// 取单个文档（含块）
async function getDoc(userId, docId) {
  const { data, error } = await supabaseAdmin
    .from(DOCS)
    .select('*')
    .eq('user_id', userId)
    .eq('id', docId)
    .maybeSingle();
  if (error) throw new Error('查询文档失败: ' + error.message);
  if (!data) return null;
  const items = await _getItems(userId, docId);
  return {
    id: data.id,
    title: data.title,
    type: data.type,
    createdAt: new Date(data.created_at).getTime(),
    items,
  };
}

// 局部更新（与整篇覆盖共用，items 缺省则不改动块）
async function patchDoc(args) {
  return updateDocFull(args);
}

// 删除文档（连带块）
async function deleteDoc({ userId, docId }) {
  await supabaseAdmin.from(ITEMS).delete().eq('doc_id', docId).eq('user_id', userId);
  const { error } = await supabaseAdmin
    .from(DOCS)
    .delete()
    .eq('user_id', userId)
    .eq('id', docId);
  if (error) throw new Error('删除文档失败: ' + error.message);
  return true;
}

// 块级操作：先读后写（保证 user 隔离 + seq 连续）
async function _mutateItems({ userId, docId, fn }) {
  const items = await _getItems(userId, docId);
  fn(items);
  await _saveItems(userId, docId, items);
  return items;
}
async function addItem({ userId, docId, item }) {
  return _mutateItems({ userId, docId, fn: (arr) => arr.push(item) });
}
async function insertItem({ userId, docId, idx, item }) {
  return _mutateItems({ userId, docId, fn: (arr) => arr.splice(idx, 0, item) });
}
async function removeItem({ userId, docId, idx }) {
  return _mutateItems({ userId, docId, fn: (arr) => arr.splice(idx, 1) });
}
// 重排：order 为新的 item 下标序列（即重排后的 items 数组本身）
async function reorderItems({ userId, docId, items }) {
  await _saveItems(userId, docId, items || []);
  return items || [];
}

module.exports = {
  getFullState,
  getCollection,
  getDoc,
  createDoc,
  updateDocFull,
  patchDoc,
  deleteDoc,
  addItem,
  insertItem,
  removeItem,
  reorderItems,
};
