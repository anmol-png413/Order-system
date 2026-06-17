export const IMG_FALLBACK = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%231a1a1a"/><text x="40" y="44" text-anchor="middle" font-size="28" fill="%23444">🍽️</text></svg>';

export function parseWeightToKg(input) {
  const s = input.trim().toLowerCase().replace(/\s/g, '');
  if (!s) return null;
  if (s.endsWith('kg')) { const n = parseFloat(s); return isNaN(n) ? null : n; }
  if (s.endsWith('g'))  { const n = parseFloat(s); return isNaN(n) ? null : n / 1000; }
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return n < 10 ? n : n / 1000;
}

export function fmtQty(quantity, quantityLabel, unit) {
  if (unit === 'piece') return `${quantity} pcs`;
  if (quantityLabel) {
    if (quantity > 1) return `${quantityLabel} × ${quantity} Box`;
    return quantityLabel;
  }
  return `${quantity} kg`;
}

export function buildSlipHTML(tokenNumber, items, notes) {
  const now = new Date();
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Green Sweets</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    @page{margin:4mm}
    body{font-family:'Courier New',monospace;width:290px;margin:auto;padding:12px;font-size:13px}
    .center{text-align:center}.bold{font-weight:bold}
    .big{font-size:32px;font-weight:900;letter-spacing:2px}
    .line{border-top:1px dashed #555;margin:8px 0}
    table{width:100%;border-collapse:collapse}
    td{padding:3px 0;vertical-align:top}
    .right{text-align:right}
    .total-row td{font-weight:bold;font-size:15px;padding-top:6px}
  </style></head><body>
  <div class="center bold" style="font-size:20px;letter-spacing:1px">Green Sweets</div>
  <div class="center" style="font-size:11px">${now.toLocaleDateString('en-IN')} &nbsp; ${now.toLocaleTimeString('en-IN')}</div>
  <div class="line"></div>
  <div class="center bold" style="font-size:11px;letter-spacing:3px">TOKEN NUMBER</div>
  <div class="center big">#${tokenNumber}</div>
  <div class="line"></div>
  <table>
    <tr><td class="bold" style="font-size:11px">ITEM</td><td class="right bold" style="font-size:11px">AMT</td></tr>
    <tr><td colspan="2"><div class="line"></div></td></tr>
    ${items.map(i => {
      const isKg = i.unit !== 'piece';
      const weightLabel = i.quantityLabel || (isKg ? i.quantity + ' kg' : '');
      const qtyLabel = isKg
        ? (i.quantity > 1 ? `${weightLabel} × ${i.quantity} pkt @ ₹${i.price.toFixed(2)}` : `${weightLabel} @ ₹${i.price.toFixed(2)}`)
        : `${i.quantity} pcs @ ₹${i.price.toFixed(2)}`;
      return `<tr>
        <td style="font-size:12px">${i.name}<br>
          <span style="color:#555;font-size:11px">${qtyLabel}</span>
        </td>
        <td class="right">₹${(i.price * i.quantity).toFixed(2)}</td>
      </tr>`;
    }).join('')}
    <tr><td colspan="2"><div class="line"></div></td></tr>
    <tr class="total-row"><td>TOTAL</td><td class="right">₹${total.toFixed(2)}</td></tr>
  </table>
  ${notes ? `<div class="line"></div><div style="font-size:11px">Note: ${notes}</div>` : ''}
  <div class="line"></div>
  <div class="center" style="font-size:12px;font-weight:bold">Thank you! Visit again ✓</div>
  <div class="center" style="font-size:10px;margin-top:4px;color:#555">+91 98880 77154</div>
  </body></html>`;
}

export function buildCustomerSlipHTML(tokenNumber, items, notes, discountPercent, bulkInfo) {
  const now = new Date();
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = +(total * (discountPercent / 100)).toFixed(2);
  const payable = +(total - discount).toFixed(2);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Green Sweets - Slip</title>
  <style>*{margin:0;padding:0}body{font-family:Arial;width:300px;padding:12px;font-size:13px}</style></head><body>
  <h3 style="text-align:center">Green Sweets</h3>
  <div>${now.toLocaleDateString()} ${now.toLocaleTimeString()}</div>
  <h2 style="text-align:center">#${tokenNumber}</h2>
  <hr />
  ${items.map(i => `<div style="display:flex;justify-content:space-between"><div>${i.name} ${i.quantityLabel ? `(${i.quantityLabel})` : ''} x${i.quantity}</div><div>₹${(i.price * i.quantity).toFixed(2)}</div></div>`).join('')}
  <hr />
  <div style="display:flex;justify-content:space-between"><div>Subtotal</div><div>₹${total.toFixed(2)}</div></div>
  ${discountPercent > 0 ? `<div style="display:flex;justify-content:space-between"><div>Discount ${discountPercent}%</div><div>-₹${discount.toFixed(2)}</div></div>` : ''}
  <div style="display:flex;justify-content:space-between;font-weight:bold"><div>Total</div><div>₹${payable.toFixed(2)}</div></div>
  ${bulkInfo ? `<div style="margin-top:8px">Phone: ${bulkInfo.phone || ''}<br/>Advance: ₹${(bulkInfo.advance || 0).toFixed(2)}<br/>Balance: ₹${((payable - (bulkInfo.advance || 0)) || 0).toFixed(2)}<br/>Schedule: ${bulkInfo.schedule || ''}</div>` : ''}
  <hr /><div style="text-align:center;font-size:12px">Thank you!</div></body></html>`;
}

export function buildInternalReceiptHTML(tokenNumber, items, notes, discountPercent, bulkInfo) {
  const now = new Date();
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = +(total * (discountPercent / 100)).toFixed(2);
  const payable = +(total - discount).toFixed(2);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title>
  <style>*{margin:0;padding:0}body{font-family:Arial;width:380px;padding:12px;font-size:13px}</style></head><body>
  <h3 style="text-align:center">Green Sweets — RECEIPT</h3>
  <div>${now.toLocaleDateString()} ${now.toLocaleTimeString()}</div>
  <h2 style="text-align:center">#${tokenNumber}</h2>
  <hr />
  ${items.map(i => `<div style="display:flex;justify-content:space-between"><div>${i.name} ${i.quantityLabel ? `(${i.quantityLabel})` : ''} x${i.quantity}</div><div>₹${(i.price * i.quantity).toFixed(2)}</div></div>`).join('')}
  <hr />
  <div style="display:flex;justify-content:space-between"><div>Subtotal</div><div>₹${total.toFixed(2)}</div></div>
  ${discountPercent > 0 ? `<div style="display:flex;justify-content:space-between"><div>Discount ${discountPercent}%</div><div>-₹${discount.toFixed(2)}</div></div>` : ''}
  <div style="display:flex;justify-content:space-between;font-weight:bold"><div>Payable</div><div>₹${payable.toFixed(2)}</div></div>
  ${bulkInfo ? `<div style="margin-top:8px">Customer Phone: ${bulkInfo.phone || ''}<br/>Advance: ₹${(bulkInfo.advance || 0).toFixed(2)}<br/>Balance: ₹${((payable - (bulkInfo.advance || 0)) || 0).toFixed(2)}<br/>Schedule: ${bulkInfo.schedule || ''}</div>` : ''}
  <hr /><div style="text-align:left;font-size:12px">Prepared by staff</div></body></html>`;
}

export function writeAndPrint(win, html) {
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.onafterprint = () => setTimeout(() => win.close(), 1500);
    setTimeout(() => { if (!win.closed) win.close(); }, 5000);
  }, 300);
}

export function printSlip(tokenNumber, items, notes) {
  const html = buildSlipHTML(tokenNumber, items, notes);
  const win = window.open('', '_blank', 'width=320,height=640');
  if (!win) return;
  writeAndPrint(win, html);
}
