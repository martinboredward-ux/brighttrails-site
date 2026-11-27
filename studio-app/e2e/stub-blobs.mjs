const stores = new Map();
export function getStore({ name }) {
  if (!stores.has(name)) stores.set(name, new Map());
  const m = stores.get(name);
  const toBuf = (d) => (d instanceof ArrayBuffer ? d : d.buffer ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : d);
  return {
    async get(k, o = {}) { const v = m.get(k); if (!v) return null; return o.type === "json" ? JSON.parse(v.data) : o.type === "arrayBuffer" ? v.data : v.data; },
    async getWithMetadata(k, o = {}) { const v = m.get(k); if (!v) return null; return { data: v.data, metadata: v.metadata }; },
    async set(k, data, o = {}) { m.set(k, { data: toBuf(data), metadata: o.metadata ?? {} }); },
    async setJSON(k, obj) { m.set(k, { data: JSON.stringify(obj), metadata: {} }); },
    async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}
