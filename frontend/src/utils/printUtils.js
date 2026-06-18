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

const BASE_STYLE = `
  *{margin:0;padding:0;box-sizing:border-box}
  @page{margin:3mm;size:80mm auto}
  body{
    font-family:'Courier New',Courier,monospace;
    width:76mm;
    margin:0 auto;
    padding:4mm 2mm;
    font-size:12px;
    color:#111;
    background:#fff;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }
  .center{text-align:center}
  .right{text-align:right}
  .left{text-align:left}
  .bold{font-weight:700}
  .small{font-size:10px}
  .tiny{font-size:9px}

  /* ── decorative separators ── */
  .sep-double{
    text-align:center;
    letter-spacing:1px;
    font-size:11px;
    color:#333;
    margin:4px 0;
  }
  .sep-dash{
    border:none;
    border-top:1px dashed #888;
    margin:5px 0;
  }
  .sep-solid{
    border:none;
    border-top:2px solid #111;
    margin:5px 0;
  }

  /* ── shop header ── */
  .shop-name{
    font-size:22px;
    font-weight:900;
    letter-spacing:3px;
    text-align:center;
    text-transform:uppercase;
  }
  .shop-tag{
    font-size:9px;
    letter-spacing:2px;
    text-align:center;
    color:#555;
    margin-top:1px;
  }
  .shop-info{
    font-size:9px;
    text-align:center;
    color:#444;
    line-height:1.6;
    margin-top:3px;
  }

  /* ── token box ── */
  .token-box{
    border:2px solid #111;
    margin:6px 0;
    padding:5px 0;
    text-align:center;
  }
  .token-label{
    font-size:9px;
    letter-spacing:4px;
    color:#555;
    text-transform:uppercase;
  }
  .token-num{
    font-size:36px;
    font-weight:900;
    letter-spacing:2px;
    line-height:1.1;
  }

  /* ── items table ── */
  .items-table{width:100%;border-collapse:collapse;margin:4px 0}
  .items-table td{padding:2px 0;vertical-align:top;line-height:1.4}
  .item-name{font-size:12px;font-weight:600}
  .item-sub{font-size:10px;color:#555}
  .item-amt{font-size:12px;text-align:right;white-space:nowrap;padding-left:4px}

  /* ── totals ── */
  .totals-row{display:flex;justify-content:space-between;padding:1px 0;font-size:12px}
  .totals-row.grand{font-size:14px;font-weight:700;padding-top:4px}
  .discount-row{color:#c00;font-size:12px}

  /* ── footer ── */
  .footer-msg{
    font-size:12px;
    font-weight:700;
    text-align:center;
    letter-spacing:1px;
    margin-top:2px;
  }
  .footer-sub{
    font-size:9px;
    text-align:center;
    color:#666;
    margin-top:2px;
    line-height:1.6;
  }
  .stars{font-size:11px;text-align:center;letter-spacing:3px;margin:3px 0}
`;

function shopHeader(now) {
  const date = now.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  const time = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
  return `
    <div class="sep-double">★ ─────────────── ★</div>
    <div class="shop-name">Green Sweets</div>
    <div class="shop-tag">— SINCE 1985 —</div>
    <div class="shop-info">
      Sector 17, Market Road, Chandigarh<br>
      📞 +91 98880 77154
    </div>
    <div class="sep-double">★ ─────────────── ★</div>
    <div class="center small" style="color:#555;margin-bottom:2px">${date} &nbsp;|&nbsp; ${time}</div>
  `;
}

function itemsRows(items) {
  return items.map(i => {
    const isKg   = i.unit !== 'piece';
    const isBox  = !!(i.quantityLabel);
    let qtyStr;
    if (i.unit === 'piece') {
      qtyStr = `${i.quantity} pcs @ ₹${i.price.toFixed(2)}/pc`;
    } else if (isBox) {
      qtyStr = i.quantity > 1
        ? `${i.quantityLabel} × ${i.quantity} Boxes @ ₹${i.price.toFixed(2)}`
        : `${i.quantityLabel} Box @ ₹${i.price.toFixed(2)}`;
    } else {
      qtyStr = `${i.quantity} kg @ ₹${i.price.toFixed(2)}/kg`;
    }
    return `
      <tr>
        <td>
          <div class="item-name">${i.name}</div>
          <div class="item-sub">${qtyStr}</div>
        </td>
        <td class="item-amt">₹${(i.price * i.quantity).toFixed(2)}</td>
      </tr>`;
  }).join('');
}

/* ════════════════════════════════════════
   1. PACKING SLIP  (internal — no discount)
   ════════════════════════════════════════ */
export function buildSlipHTML(tokenNumber, items, notes) {
  const now   = new Date();
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Green Sweets - Packing Slip</title>
  <style>${BASE_STYLE}</style></head><body>

  ${shopHeader(now)}

  <div class="token-box">
    <div class="token-label">Token Number</div>
    <div class="token-num">#${tokenNumber}</div>
  </div>

  <div class="center tiny" style="letter-spacing:2px;color:#555;margin-bottom:4px">PACKING SLIP</div>
  <hr class="sep-solid">

  <table class="items-table">
    <tr>
      <td class="bold tiny" style="letter-spacing:1px">ITEM &amp; QTY</td>
      <td class="bold tiny right" style="letter-spacing:1px">AMOUNT</td>
    </tr>
    <tr><td colspan="2"><hr class="sep-dash"></td></tr>
    ${itemsRows(items)}
    <tr><td colspan="2"><hr class="sep-dash"></td></tr>
    <tr>
      <td class="bold" style="font-size:13px">TOTAL</td>
      <td class="item-amt bold" style="font-size:13px">₹${total.toFixed(2)}</td>
    </tr>
  </table>

  ${notes ? `<hr class="sep-dash"><div class="small" style="color:#555">📝 Note: ${notes}</div>` : ''}

  <hr class="sep-solid">
  <div class="stars">✦ ✦ ✦</div>
  <div class="footer-msg">Thank you! 🙏</div>
  <div class="footer-sub">
    Visit us again<br>
    <span style="letter-spacing:1px">GREEN SWEETS</span>
  </div>
  <div class="sep-double" style="margin-top:6px">★ ─────────────── ★</div>

  </body></html>`;
}

/* ════════════════════════════════════════
   2. CUSTOMER BILL  (with discount + bulk)
   ════════════════════════════════════════ */
export function buildCustomerSlipHTML(tokenNumber, items, notes, discountPercent, bulkInfo) {
  const now      = new Date();
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = +(subtotal * ((discountPercent || 0) / 100)).toFixed(2);
  const payable  = +(subtotal - discount).toFixed(2);
  const advance  = bulkInfo ? (Number(bulkInfo.advance) || 0) : 0;
  const balance  = +(payable - advance).toFixed(2);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Green Sweets - Bill</title>
  <style>${BASE_STYLE}</style></head><body>

  ${shopHeader(now)}

  <div class="token-box">
    <div class="token-label">Bill No. / Token</div>
    <div class="token-num">#${tokenNumber}</div>
  </div>

  ${bulkInfo && bulkInfo.customerName ? `
    <div class="center bold" style="font-size:12px;margin:2px 0">${bulkInfo.customerName}</div>` : ''}
  ${bulkInfo && bulkInfo.phone ? `
    <div class="center small" style="color:#555">📞 ${bulkInfo.phone}</div>` : ''}

  <hr class="sep-solid">

  <table class="items-table">
    <tr>
      <td class="bold tiny" style="letter-spacing:1px">ITEM &amp; QTY</td>
      <td class="bold tiny right" style="letter-spacing:1px">AMOUNT</td>
    </tr>
    <tr><td colspan="2"><hr class="sep-dash"></td></tr>
    ${itemsRows(items)}
    <tr><td colspan="2"><hr class="sep-dash"></td></tr>
  </table>

  <div class="totals-row">
    <span>Subtotal</span>
    <span>₹${subtotal.toFixed(2)}</span>
  </div>
  ${discountPercent > 0 ? `
  <div class="totals-row discount-row">
    <span>Discount (${discountPercent}%)</span>
    <span>- ₹${discount.toFixed(2)}</span>
  </div>` : ''}

  <hr class="sep-solid">
  <div class="totals-row grand">
    <span>TOTAL PAYABLE</span>
    <span>₹${payable.toFixed(2)}</span>
  </div>

  ${bulkInfo && advance > 0 ? `
  <hr class="sep-dash">
  <div class="totals-row small">
    <span>Advance Paid</span>
    <span>₹${advance.toFixed(2)}</span>
  </div>
  <div class="totals-row small bold ${balance > 0 ? '' : ''}">
    <span>${balance > 0 ? 'Balance Due' : 'Fully Paid ✓'}</span>
    <span>${balance > 0 ? `₹${balance.toFixed(2)}` : '—'}</span>
  </div>` : ''}

  ${bulkInfo && bulkInfo.schedule ? `
  <hr class="sep-dash">
  <div class="small" style="color:#555">📅 Delivery: ${new Date(bulkInfo.schedule).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>` : ''}

  ${notes ? `<hr class="sep-dash"><div class="small" style="color:#555">📝 ${notes}</div>` : ''}

  <hr class="sep-dash">
  <div class="stars">✦ ✦ ✦</div>
  <div class="footer-msg">Thank You! 🙏</div>
  <div class="footer-sub">
    Goods once sold will not be taken back<br>
    📞 +91 98880 77154
  </div>
  <div class="sep-double" style="margin-top:6px">★ ─────────────── ★</div>

  </body></html>`;
}

/* ════════════════════════════════════════
   3. INTERNAL RECEIPT  (staff copy)
   ════════════════════════════════════════ */
export function buildInternalReceiptHTML(tokenNumber, items, notes, discountPercent, bulkInfo) {
  const now      = new Date();
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = +(subtotal * ((discountPercent || 0) / 100)).toFixed(2);
  const payable  = +(subtotal - discount).toFixed(2);
  const advance  = bulkInfo ? (Number(bulkInfo.advance) || 0) : 0;
  const balance  = +(payable - advance).toFixed(2);

  const date = now.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  const time = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Green Sweets - Receipt</title>
  <style>${BASE_STYLE}</style></head><body>

  <div class="sep-double">★ ─────────────── ★</div>
  <div class="shop-name">Green Sweets</div>
  <div class="shop-tag">— STAFF COPY —</div>
  <div class="sep-double">★ ─────────────── ★</div>

  <div class="small" style="color:#555;margin-bottom:2px">${date} &nbsp;|&nbsp; ${time}</div>

  <div class="token-box">
    <div class="token-label">Token Number</div>
    <div class="token-num">#${tokenNumber}</div>
  </div>

  ${bulkInfo && bulkInfo.customerName ? `<div class="bold small">Customer: ${bulkInfo.customerName}</div>` : ''}
  ${bulkInfo && bulkInfo.phone        ? `<div class="small" style="color:#555">Phone: ${bulkInfo.phone}</div>` : ''}
  ${bulkInfo && bulkInfo.schedule     ? `<div class="small" style="color:#555">Delivery: ${new Date(bulkInfo.schedule).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>` : ''}

  <hr class="sep-solid">

  <table class="items-table">
    <tr>
      <td class="bold tiny" style="letter-spacing:1px">ITEM</td>
      <td class="bold tiny right" style="letter-spacing:1px">AMT</td>
    </tr>
    <tr><td colspan="2"><hr class="sep-dash"></td></tr>
    ${itemsRows(items)}
    <tr><td colspan="2"><hr class="sep-dash"></td></tr>
  </table>

  <div class="totals-row">
    <span>Subtotal</span>
    <span>₹${subtotal.toFixed(2)}</span>
  </div>
  ${discountPercent > 0 ? `
  <div class="totals-row discount-row">
    <span>Discount (${discountPercent}%)</span>
    <span>- ₹${discount.toFixed(2)}</span>
  </div>` : ''}
  <hr class="sep-solid">
  <div class="totals-row grand">
    <span>PAYABLE</span>
    <span>₹${payable.toFixed(2)}</span>
  </div>

  ${advance > 0 ? `
  <hr class="sep-dash">
  <div class="totals-row small">
    <span>Advance</span>
    <span>₹${advance.toFixed(2)}</span>
  </div>
  <div class="totals-row small bold">
    <span>Balance Due</span>
    <span>₹${Math.max(0, balance).toFixed(2)}</span>
  </div>` : ''}

  ${notes ? `<hr class="sep-dash"><div class="small" style="color:#555">Note: ${notes}</div>` : ''}

  <hr class="sep-dash">
  <div class="center tiny" style="color:#888;margin-top:4px">Prepared by staff — Internal copy</div>
  <div class="sep-double" style="margin-top:4px">★ ─────────────── ★</div>

  </body></html>`;
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
