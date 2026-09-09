import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3, Boxes, BriefcaseBusiness, Coffee, Database, Download,
  FileUp, PackageSearch, RefreshCcw, ShoppingCart, TrendingUp, Users,
  WalletCards, CircleDollarSign, Activity, AlertCircle, CheckCircle2
} from 'lucide-react';
import './styles.css';

const REQUIRED_COLUMNS = [
  'id_registro','tipo_registro','subtipo','fecha','fecha_factura','fecha_corte',
  'cliente','tipo_cliente','categoria','producto','producto_original','tamano_g',
  'forma','canal','cantidad','monto_crc','estado_entrega','pagado',
  'tipo_movimiento','stock_actual','estado','notas'
];

const INACTIVE_DAYS = 45;

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else {
      if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const cleanRows = rows.filter(r => r.some(v => String(v).trim() !== ''));
  if (!cleanRows.length) return [];
  const headers = cleanRows[0].map(h => h.replace(/^\uFEFF/, '').trim());
  return cleanRows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

function n(v) { const x = Number(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(x) ? x : 0; }
function d(v) { return v ? new Date(`${v}T12:00:00`) : null; }
function fmtCRC(v) { return new Intl.NumberFormat('es-CR', { style:'currency', currency:'CRC', maximumFractionDigits:0 }).format(v || 0); }
function fmtN(v, decimals=0) { return new Intl.NumberFormat('es-CR', { maximumFractionDigits:decimals }).format(v || 0); }
function fmtDate(v) { if (!v) return '—'; const x=d(v); return x ? new Intl.DateTimeFormat('es-CR',{day:'2-digit',month:'short',year:'numeric'}).format(x) : '—'; }
function daysBetween(a,b) { return Math.floor((b-a)/(1000*60*60*24)); }
function skuLabel(r) { return [r.producto, r.tamano_g ? `${r.tamano_g}g` : '', r.forma].filter(Boolean).join(' · '); }

function sum(rows, key) { return rows.reduce((acc,r)=>acc+n(r[key]),0); }
function groupSum(rows, keyFn, valueFn) {
  const m = new Map();
  rows.forEach(r => { const k=keyFn(r)||'Sin especificar'; m.set(k,(m.get(k)||0)+valueFn(r)); });
  return [...m.entries()].map(([name,value])=>({name,value}));
}

function Kpi({icon:Icon,label,value,detail}) {
  return <div className="kpi card"><div className="kpi-icon"><Icon size={20}/></div><div><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div>{detail && <div className="kpi-detail">{detail}</div>}</div></div>
}

function SectionTitle({icon:Icon,title,subtitle,action}) {
  return <div className="section-head"><div className="section-title-wrap"><div className="section-icon"><Icon size={20}/></div><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{action}</div>
}

function BarList({data, formatter=fmtN, maxItems=10}) {
  const shown=[...data].sort((a,b)=>b.value-a.value).slice(0,maxItems); const max=Math.max(...shown.map(x=>x.value),1);
  return <div className="bar-list">{shown.map((x,i)=><div className="bar-row" key={`${x.name}-${i}`}><div className="bar-meta"><span>{x.name}</span><strong>{formatter(x.value)}</strong></div><div className="bar-track"><div className="bar-fill" style={{width:`${Math.max(3,(x.value/max)*100)}%`}}/></div></div>)}</div>
}

function LineChart({data, formatter=fmtCRC}) {
  if (!data.length) return <div className="empty">Sin datos para graficar.</div>;
  const W=780,H=230,p=30; const max=Math.max(...data.map(x=>x.value),1); const min=0;
  const pts=data.map((x,i)=>{const xx=p+(i*(W-2*p))/Math.max(data.length-1,1); const yy=H-p-((x.value-min)/(max-min||1))*(H-2*p); return [xx,yy];});
  const path=pts.map((pt,i)=>`${i?'L':'M'}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(' ');
  const labels=data.length<=8?data:data.filter((_,i)=>i===0||i===data.length-1||i%Math.ceil(data.length/6)===0);
  return <div className="chart-wrap"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfico de evolución"><line x1={p} y1={H-p} x2={W-p} y2={H-p} className="axis"/><line x1={p} y1={p} x2={p} y2={H-p} className="axis"/><path d={path} className="line-path" fill="none"/><path d={`${path} L${pts.at(-1)[0]},${H-p} L${pts[0][0]},${H-p} Z`} className="area-path"/>{pts.map((pt,i)=><circle key={i} cx={pt[0]} cy={pt[1]} r="3" className="dot"><title>{data[i].name}: {formatter(data[i].value)}</title></circle>)}{labels.map((x,li)=>{const idx=data.indexOf(x);const [xx]=pts[idx];return <text key={li} x={xx} y={H-8} textAnchor={idx===0?'start':idx===data.length-1?'end':'middle'} className="chart-label">{x.name.slice(5)}</text>})}</svg></div>
}

function DataTable({columns,rows,maxRows=25}) {
  return <div className="table-scroll"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.slice(0,maxRows).map((r,i)=><tr key={r.id_registro||i}>{columns.map(c=><td key={c.key}>{c.render?c.render(r):r[c.key]||'—'}</td>)}</tr>)}</tbody></table>{rows.length>maxRows && <div className="table-note">Mostrando {maxRows} de {rows.length} registros.</div>}</div>
}

function App(){
  const [rows,setRows]=useState([]); const [sourceName,setSourceName]=useState('manino_master.csv');
  const [error,setError]=useState(''); const [tab,setTab]=useState('resumen'); const [clientType,setClientType]=useState('Todos');
  const fileRef=useRef();
  const loadDefault=async()=>{ try{setError(''); const t=await (await fetch('/manino_master.csv',{cache:'no-store'})).text(); const p=parseCSV(t); validate(p); setRows(p); setSourceName('manino_master.csv');}catch(e){setError(e.message)} };
  useEffect(()=>{loadDefault()},[]);
  const validate=(p)=>{ if(!p.length) throw new Error('El CSV no contiene registros.'); const missing=REQUIRED_COLUMNS.filter(c=>!(c in p[0])); if(missing.length) throw new Error(`CSV incompatible. Faltan columnas: ${missing.join(', ')}`); };
  const onUpload=async(e)=>{const f=e.target.files?.[0]; if(!f)return; try{const t=await f.text();const p=parseCSV(t);validate(p);setRows(p);setSourceName(f.name);setError('');}catch(err){setError(err.message)} finally{e.target.value='';}};

  const cutDate=useMemo(()=>{const vals=rows.map(r=>r.fecha_corte).filter(Boolean).sort();return vals.at(-1)||''},[rows]);
  const orders=useMemo(()=>rows.filter(r=>r.tipo_registro==='DEMANDA'&&r.subtipo==='PEDIDO'&&r.tipo_movimiento!=='Regalía'),[rows]);
  const items=useMemo(()=>rows.filter(r=>r.tipo_registro==='DEMANDA'&&r.subtipo==='ITEM'),[rows]);
  const invoices=useMemo(()=>rows.filter(r=>r.tipo_registro==='COMPRA'&&r.subtipo==='FACTURA'),[rows]);
  const purchaseSku=useMemo(()=>rows.filter(r=>r.tipo_registro==='COMPRA'&&r.subtipo==='SKU'),[rows]);
  const stock=useMemo(()=>rows.filter(r=>r.tipo_registro==='INVENTARIO'&&r.subtipo==='STOCK'),[rows]);
  const filteredOrders=useMemo(()=>clientType==='Todos'?orders:orders.filter(r=>r.tipo_cliente===clientType),[orders,clientType]);
  const filteredItems=useMemo(()=>clientType==='Todos'?items:items.filter(r=>r.tipo_cliente===clientType),[items,clientType]);

  const sales=sum(filteredOrders,'monto_crc'); const orderCount=filteredOrders.length; const demandUnits=sum(filteredItems,'cantidad');
  const purchaseAmount=sum(invoices,'monto_crc'); const stockUnits=sum(stock,'stock_actual'); const zeroStock=stock.filter(r=>n(r.stock_actual)===0).length;

  const customerRows=useMemo(()=>{
    const by=new Map(); const ref=cutDate?d(cutDate):new Date();
    filteredOrders.forEach(r=>{const k=r.cliente;if(!k)return; const x=by.get(k)||{cliente:k,tipo_cliente:r.tipo_cliente,pedidos:0,ventas:0,ultima:'',ticket:0,estado:'',dias:0}; x.pedidos++;x.ventas+=n(r.monto_crc); if(!x.ultima||r.fecha>x.ultima)x.ultima=r.fecha;by.set(k,x);});
    [...by.values()].forEach(x=>{x.ticket=x.pedidos?x.ventas/x.pedidos:0; x.dias=x.ultima&&ref?daysBetween(d(x.ultima),ref):0; x.estado=x.dias>INACTIVE_DAYS?'Inactivo':'Activo';});
    return [...by.values()].sort((a,b)=>b.ventas-a.ventas);
  },[filteredOrders,cutDate]);
  const uniqueCustomers=customerRows.length; const active=customerRows.filter(x=>x.estado==='Activo').length; const inactive=uniqueCustomers-active;
  const recurring=customerRows.filter(x=>x.pedidos>1).length; const avgTicket=orderCount?sales/orderCount:0;
  const concentration5=sales?customerRows.slice(0,5).reduce((a,x)=>a+x.ventas,0)/sales*100:0;
  const concentration10=sales?customerRows.slice(0,10).reduce((a,x)=>a+x.ventas,0)/sales*100:0;

  const salesByDate=useMemo(()=>groupSum(filteredOrders,r=>r.fecha,r=>n(r.monto_crc)).sort((a,b)=>a.name.localeCompare(b.name)),[filteredOrders]);
  const demandBySku=useMemo(()=>groupSum(filteredItems,r=>skuLabel(r),r=>n(r.cantidad)),[filteredItems]);
  const purchaseByDate=useMemo(()=>groupSum(invoices,r=>r.fecha_factura||r.fecha,r=>n(r.monto_crc)).sort((a,b)=>a.name.localeCompare(b.name)),[invoices]);
  const boughtSku=useMemo(()=>groupSum(purchaseSku,r=>skuLabel(r),r=>n(r.cantidad)),[purchaseSku]);

  const downloadCurrent=()=>{ const a=document.createElement('a');a.href='/manino_master.csv';a.download='manino_master.csv';a.click(); };

  const nav=[['resumen','Resumen',BarChart3],['demanda','Demanda',TrendingUp],['compras','Compras',ShoppingCart],['inventario','Inventario',Boxes],['clientes','Cartera',Users],['avanzado','Análisis',Activity]];

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Coffee size={23}/></div><div><strong>MANINO</strong><span>COFFEE ANALYTICS</span></div></div><nav>{nav.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={18}/><span>{label}</span></button>)}</nav><div className="sidebar-foot"><span>Fuente activa</span><strong title={sourceName}>{sourceName}</strong><small>Corte: {fmtDate(cutDate)}</small></div></aside>
    <main><header className="topbar"><div><h1>Panel de Análisis</h1><p>Demanda · Compras · Inventario · Cartera de clientes</p></div><div className="toolbar"><select value={clientType} onChange={e=>setClientType(e.target.value)}><option>Todos</option><option value="B2B">B2B</option><option value="B2C">B2C</option></select><input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onUpload}/><button className="btn secondary" onClick={()=>fileRef.current?.click()}><FileUp size={17}/>Cargar CSV</button><button className="btn ghost" onClick={loadDefault}><RefreshCcw size={17}/>Restaurar</button></div></header>
      {error && <div className="alert"><AlertCircle size={18}/><span>{error}</span></div>}
      <div className="content">
        {tab==='resumen' && <>
          <div className="hero"><div><span className="eyebrow">VISIÓN EJECUTIVA</span><h2>La operación de Manino en cuatro frentes</h2><p>Primero, los analistas ven la demanda, las compras, el inventario y la cartera. Después pueden profundizar en comportamiento, concentración y recurrencia.</p></div><div className="status-pill"><CheckCircle2 size={16}/>Todas las ventas cargadas figuran como pagadas</div></div>
          <div className="kpi-grid four"><Kpi icon={CircleDollarSign} label="Ventas" value={fmtCRC(sales)} detail={`${fmtN(orderCount)} pedidos`}/><Kpi icon={ShoppingCart} label="Compras" value={fmtCRC(purchaseAmount)} detail={`${fmtN(sum(purchaseSku,'cantidad'))} unidades conciliadas por SKU`}/><Kpi icon={Boxes} label="Inventario" value={`${fmtN(stockUnits)} u`} detail={`${zeroStock} SKU sin stock`}/><Kpi icon={Users} label="Clientes" value={fmtN(uniqueCustomers)} detail={`${active} activos · ${inactive} inactivos`}/></div>
          <div className="grid-2"><section className="card panel"><SectionTitle icon={TrendingUp} title="Demanda" subtitle="Unidades demandadas por SKU"/><BarList data={demandBySku} maxItems={8}/></section><section className="card panel"><SectionTitle icon={Users} title="Cartera" subtitle="Clientes con mayor facturación"/><BarList data={customerRows.map(x=>({name:x.cliente,value:x.ventas}))} formatter={fmtCRC} maxItems={8}/></section></div>
          <div className="grid-2"><section className="card panel"><SectionTitle icon={ShoppingCart} title="Compras" subtitle="Evolución por fecha de factura"/><LineChart data={purchaseByDate}/></section><section className="card panel"><SectionTitle icon={Boxes} title="Inventario" subtitle="Stock actual por SKU"/><BarList data={stock.map(r=>({name:skuLabel(r),value:n(r.stock_actual)}))} maxItems={8}/></section></div>
        </>}
        {tab==='demanda' && <><SectionTitle icon={TrendingUp} title="Demanda" subtitle="Ventas, pedidos, unidades y productos demandados"/><div className="kpi-grid"><Kpi icon={CircleDollarSign} label="Ventas totales" value={fmtCRC(sales)}/><Kpi icon={WalletCards} label="Pedidos" value={fmtN(orderCount)}/><Kpi icon={PackageSearch} label="Unidades demandadas" value={fmtN(demandUnits)}/><Kpi icon={Coffee} label="SKU con demanda" value={fmtN(new Set(filteredItems.map(skuLabel)).size)}/></div><div className="grid-2"><section className="card panel"><h3>Evolución de ventas</h3><LineChart data={salesByDate}/></section><section className="card panel"><h3>Demanda por SKU</h3><BarList data={demandBySku} maxItems={14}/></section></div></>}
        {tab==='compras' && <><SectionTitle icon={ShoppingCart} title="Compras" subtitle="Primero monto total, evolución por fecha y unidades compradas por SKU"/><div className="kpi-grid three"><Kpi icon={CircleDollarSign} label="Monto total comprado" value={fmtCRC(purchaseAmount)}/><Kpi icon={BriefcaseBusiness} label="Facturas conciliadas" value={fmtN(invoices.length)}/><Kpi icon={PackageSearch} label="Unidades por SKU" value={fmtN(sum(purchaseSku,'cantidad'))}/></div><div className="grid-2"><section className="card panel"><h3>Evolución de compras</h3><LineChart data={purchaseByDate}/></section><section className="card panel"><h3>Unidades compradas por SKU</h3><BarList data={boughtSku} maxItems={16}/></section></div><section className="card panel"><h3>Detalle de facturas</h3><DataTable rows={[...invoices].sort((a,b)=>b.fecha.localeCompare(a.fecha))} columns={[{key:'fecha_factura',label:'Fecha factura',render:r=>fmtDate(r.fecha_factura)},{key:'monto_crc',label:'Monto',render:r=>fmtCRC(n(r.monto_crc))},{key:'estado',label:'Estado'},{key:'notas',label:'Notas'}]}/></section></>}
        {tab==='inventario' && <><SectionTitle icon={Boxes} title="Inventario" subtitle={`Stock al corte ${fmtDate(cutDate)}`}/><div className="kpi-grid three"><Kpi icon={Boxes} label="Unidades en stock" value={fmtN(stockUnits)}/><Kpi icon={Database} label="SKU inventariados" value={fmtN(stock.length)}/><Kpi icon={AlertCircle} label="SKU sin stock" value={fmtN(zeroStock)}/></div><section className="card panel"><h3>Inventario por SKU</h3><DataTable rows={[...stock].sort((a,b)=>n(a.stock_actual)-n(b.stock_actual))} maxRows={50} columns={[{key:'categoria',label:'Categoría'},{key:'producto',label:'Producto'},{key:'tamano_g',label:'Tamaño',render:r=>r.tamano_g?`${r.tamano_g} g`:'—'},{key:'forma',label:'Forma'},{key:'stock_actual',label:'Stock',render:r=><span className={n(r.stock_actual)===0?'stock-zero':'stock-ok'}>{fmtN(n(r.stock_actual))}</span>} ]}/></section></>}
        {tab==='clientes' && <><SectionTitle icon={Users} title="Cartera de clientes" subtitle={`Inactivo = más de ${INACTIVE_DAYS} días sin comprar, tomando como referencia el corte del archivo`}/><div className="kpi-grid four"><Kpi icon={Users} label="Clientes únicos" value={fmtN(uniqueCustomers)}/><Kpi icon={CheckCircle2} label="Activos" value={fmtN(active)}/><Kpi icon={AlertCircle} label="Inactivos" value={fmtN(inactive)}/><Kpi icon={WalletCards} label="Ticket promedio" value={fmtCRC(avgTicket)}/></div><div className="grid-2"><section className="card panel"><h3>Top 10 por facturación</h3><BarList data={customerRows.map(x=>({name:x.cliente,value:x.ventas}))} formatter={fmtCRC}/></section><section className="card panel"><h3>Recurrencia</h3><div className="metric-stack"><div><span>Clientes con más de 1 pedido</span><strong>{fmtN(recurring)} <small>({uniqueCustomers?fmtN(recurring/uniqueCustomers*100,1):0}%)</small></strong></div><div><span>Clientes de una sola compra</span><strong>{fmtN(uniqueCustomers-recurring)}</strong></div><div><span>Concentración Top 5</span><strong>{fmtN(concentration5,1)}%</strong></div><div><span>Concentración Top 10</span><strong>{fmtN(concentration10,1)}%</strong></div></div></section></div><section className="card panel"><h3>Detalle de cartera</h3><DataTable rows={customerRows} maxRows={100} columns={[{key:'cliente',label:'Cliente'},{key:'tipo_cliente',label:'Tipo'},{key:'pedidos',label:'Pedidos'},{key:'ventas',label:'Ventas',render:r=>fmtCRC(r.ventas)},{key:'ticket',label:'Ticket prom.',render:r=>fmtCRC(r.ticket)},{key:'ultima',label:'Última compra',render:r=>fmtDate(r.ultima)},{key:'estado',label:'Estado',render:r=><span className={`badge ${r.estado==='Activo'?'green':'muted'}`}>{r.estado}</span>} ]}/></section></>}
        {tab==='avanzado' && <><SectionTitle icon={Activity} title="Análisis ampliado" subtitle="Indicadores de comportamiento y concentración"/><div className="kpi-grid four"><Kpi icon={WalletCards} label="Ticket promedio" value={fmtCRC(avgTicket)}/><Kpi icon={Users} label="Recurrentes" value={`${fmtN(recurring)} clientes`}/><Kpi icon={BarChart3} label="Top 5 / ventas" value={`${fmtN(concentration5,1)}%`}/><Kpi icon={BarChart3} label="Top 10 / ventas" value={`${fmtN(concentration10,1)}%`}/></div><div className="grid-2"><section className="card panel"><h3>Ventas por fecha</h3><LineChart data={salesByDate}/></section><section className="card panel"><h3>Top clientes</h3><BarList data={customerRows.map(x=>({name:x.cliente,value:x.ventas}))} formatter={fmtCRC} maxItems={15}/></section></div><section className="card panel"><h3>Reglas de lectura</h3><div className="rules"><span><CheckCircle2/>Todas las ventas del CSV maestro están tratadas como pagadas.</span><span><CheckCircle2/>Sabor y Pan está incluido en totales y clasificado B2B; el resto se presenta como B2C.</span><span><CheckCircle2/>La cartera se deriva de registros DEMANDA / PEDIDO para evitar duplicar totales.</span><span><CheckCircle2/>Las unidades por producto se derivan de DEMANDA / ITEM.</span><span><CheckCircle2/>La inactividad usa un umbral fijo de 45 días respecto a fecha_corte.</span></div></section></>}
      </div>
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
