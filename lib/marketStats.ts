export function statColor(type: string, v: number | null) {
  if (v == null || v === 0) return { bg:"#f5f5f3", border:"#e5e7eb", val:"#6b7280", note:"#9ca3af", bar:"#d1d5db" };
  if (type==="mos")    return v<4  ?{bg:"#f0fdf4",border:"#86efac",val:"#15803d",note:"#16a34a",bar:"#16a34a"}:v<=6 ?{bg:"#fffbeb",border:"#fcd34d",val:"#92400e",note:"#d97706",bar:"#d97706"}:{bg:"#fef2f2",border:"#fca5a5",val:"#991b1b",note:"#dc2626",bar:"#dc2626"};
  if (type==="dom")    return v<30 ?{bg:"#f0fdf4",border:"#86efac",val:"#15803d",note:"#16a34a",bar:"#16a34a"}:v<=60?{bg:"#fffbeb",border:"#fcd34d",val:"#92400e",note:"#d97706",bar:"#d97706"}:{bg:"#fef2f2",border:"#fca5a5",val:"#991b1b",note:"#dc2626",bar:"#dc2626"};
  if (type==="pct")    return v<15 ?{bg:"#f0fdf4",border:"#86efac",val:"#15803d",note:"#16a34a",bar:"#16a34a"}:v<=25?{bg:"#fffbeb",border:"#fcd34d",val:"#92400e",note:"#d97706",bar:"#d97706"}:{bg:"#fef2f2",border:"#fca5a5",val:"#991b1b",note:"#dc2626",bar:"#dc2626"};
  if (type==="cutpct")    return v<5  ?{bg:"#f0fdf4",border:"#86efac",val:"#15803d",note:"#16a34a",bar:"#16a34a"}:v<=10?{bg:"#fffbeb",border:"#fcd34d",val:"#92400e",note:"#d97706",bar:"#d97706"}:{bg:"#fef2f2",border:"#fca5a5",val:"#991b1b",note:"#dc2626",bar:"#dc2626"};
  if (type==="rent")      return v>2500?{bg:"#f0fdf4",border:"#86efac",val:"#15803d",note:"#16a34a",bar:"#16a34a"}:v>=1500?{bg:"#fffbeb",border:"#fcd34d",val:"#92400e",note:"#d97706",bar:"#d97706"}:{bg:"#fef2f2",border:"#fca5a5",val:"#991b1b",note:"#dc2626",bar:"#dc2626"};
  if (type==="rentgrowth")return v>3  ?{bg:"#f0fdf4",border:"#86efac",val:"#15803d",note:"#16a34a",bar:"#16a34a"}:v>=0  ?{bg:"#fffbeb",border:"#fcd34d",val:"#92400e",note:"#d97706",bar:"#d97706"}:{bg:"#fef2f2",border:"#fca5a5",val:"#991b1b",note:"#dc2626",bar:"#dc2626"};
  if (type==="yield")     return v>6  ?{bg:"#f0fdf4",border:"#86efac",val:"#15803d",note:"#16a34a",bar:"#16a34a"}:v>=4  ?{bg:"#fffbeb",border:"#fcd34d",val:"#92400e",note:"#d97706",bar:"#d97706"}:{bg:"#fef2f2",border:"#fca5a5",val:"#991b1b",note:"#dc2626",bar:"#dc2626"};
  if (type==="rtm")       return v>=1 ?{bg:"#f0fdf4",border:"#86efac",val:"#15803d",note:"#16a34a",bar:"#16a34a"}:v>=0.85?{bg:"#fffbeb",border:"#fcd34d",val:"#92400e",note:"#d97706",bar:"#d97706"}:{bg:"#fef2f2",border:"#fca5a5",val:"#991b1b",note:"#dc2626",bar:"#dc2626"};
  return { bg:"#f5f5f3", border:"#e5e7eb", val:"#374151", note:"#9ca3af", bar:"#d1d5db" };
}

export function computeMarketStats(scored: any[], monthsSupply: number | null) {
  const allWithDOM  = scored.filter(p => p.dom > 0);
  const allWithCuts = scored.filter(p => p.pricecuts > 0);

  const computedDOM = allWithDOM.length
    ? Math.round(allWithDOM.reduce((s: number, p: any) => s + p.dom, 0) / allWithDOM.length)
    : null;

  const computedPct = scored.length
    ? Math.round((allWithCuts.length / scored.length) * 100)
    : null;

  const computedCutPct = allWithCuts.length
    ? Math.round(allWithCuts.reduce((s: number, p: any) => {
        const orig = p.priceHistory?.[0]?.price || p.price;
        return s + (orig > 0 ? ((orig - p.price) / orig * 100) : 0);
      }, 0) / allWithCuts.length * 10) / 10
    : 0;

  return [
    { abbr:"IN", label:"Inventory",                  type:"mos",    raw:monthsSupply,  display:monthsSupply!=null?`${monthsSupply.toFixed(1)} mo`:"—",  barMax:12,  note:monthsSupply!=null?(monthsSupply<4?"Below avg (4 mo)":monthsSupply<=6?"Near avg (4 mo)":"Above avg (4 mo)"):"—" },
    { abbr:"DM", label:"Avg Days on Market",         type:"dom",    raw:computedDOM,   display:computedDOM!=null?`${computedDOM} days`:"—",             barMax:120, note:computedDOM!=null?(computedDOM<30?"Below avg (30d)":computedDOM<=60?"Near avg (30d)":"Above avg (30d)"):"—" },
    { abbr:"PC", label:"Properties w/ Price Cuts",   type:"pct",    raw:computedPct,   display:computedPct!=null?`${computedPct}%`:"—",                 barMax:50,  note:computedPct!=null?(computedPct<15?"Below avg (15%)":computedPct<=25?"Near avg (15%)":"Above avg (15%)"):"—" },
    { abbr:"AC", label:"Avg Price Cut",              type:"cutpct", raw:computedCutPct,display:computedCutPct>0?`${computedCutPct}%`:"—",               barMax:25,  note:computedCutPct>0?(computedCutPct<5?"Below avg (5%)":computedCutPct<=10?"Near avg (5%)":"Above avg (5%)"):"—" },
  ];
}
