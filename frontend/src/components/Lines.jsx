/** Editable list of {product_id, quantity} lines shared by receive / issue / transfer / purchase orders. */
export default function Lines({ products, lines, setLines, withCost = false, lockProducts = false }) {
  const update = (i, patch) => setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i) => setLines(lines.filter((_, idx) => idx !== i));
  return (
    <div className="lines">
      {lines.map((l, i) => (
        <div className="line" key={i}>
          <label className="field grow"><span>Product</span>
            <select value={l.product_id} disabled={lockProducts} onChange={(e) => update(i, { product_id: e.target.value })} required>
              <option value="">Choose a product</option>
              {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.sku} · {p.name}</option>)}
            </select>
          </label>
          <label className="field narrow"><span>Quantity</span>
            <input type="number" min="1" step="1" value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} required />
          </label>
          {withCost && (
            <label className="field narrow"><span>Unit cost</span>
              <input type="number" min="0" value={l.unit_cost ?? ''} onChange={(e) => update(i, { unit_cost: e.target.value })} placeholder="Default" />
            </label>
          )}
          {!lockProducts && lines.length > 1 && <button type="button" className="link" onClick={() => remove(i)}>Remove</button>}
        </div>
      ))}
      {!lockProducts && <button type="button" onClick={() => setLines([...lines, { product_id: '', quantity: '' }])}>Add another product</button>}
    </div>
  );
}
