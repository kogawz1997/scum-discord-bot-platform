// Primitives: badges, cards, tables, buttons, modal
const { useState, useEffect, useMemo, useRef, useCallback } = React;

const Icon = ({ name, size=14, className='', style }) => {
  const paths = {
    search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></>,
    bell:<><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    chevronDown:<path d="m6 9 6 6 6-6"/>,
    chevronRight:<path d="m9 6 6 6-6 6"/>,
    chevronLeft:<path d="m15 6-6 6 6 6"/>,
    plus:<path d="M12 5v14M5 12h14"/>,
    filter:<path d="M3 6h18M6 12h12M10 18h4"/>,
    x:<path d="M18 6 6 18M6 6l12 12"/>,
    refresh:<><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    alert:<><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>,
    check:<path d="M20 6 9 17l-5-5"/>,
    dot:<circle cx="12" cy="12" r="4"/>,
    lock:<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    pkg:<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></>,
    server:<><rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><path d="M6 7h.01M6 17h.01"/></>,
    bot:<><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M12 3v4M9 11v2M15 11v2M8 17h8"/></>,
    truck:<><path d="M14 18V6h6l3 4v8h-2"/><path d="M14 18H4V6h10v12z"/><circle cx="7" cy="20" r="2"/><circle cx="18" cy="20" r="2"/></>,
    users:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    activity:<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>,
    shield:<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    grid:<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    layers:<><path d="m12 2 10 5-10 5L2 7l10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/></>,
    radio:<><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2a6 6 0 0 1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"/></>,
    lifebuoy:<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.93 4.93 4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M14.83 9.17l3.53-3.53M4.93 19.07l4.24-4.24"/></>,
    list:<><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
    file:<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
    copy:<><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
    external:<><path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></>,
    arrowUp:<path d="M12 19V5M5 12l7-7 7 7"/>,
    arrowDown:<path d="M12 5v14M19 12l-7 7-7-7"/>,
    wifi:<><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></>,
    wifiOff:<><path d="M1 1l22 22M8.5 16.5a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><circle cx="12" cy="20" r="1"/></>,
    clock:<><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
    moreH:<><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>{paths[name]}</svg>;
};

const Badge = ({ tone='default', children, style, icon }) => {
  const tones = {
    default:{bg:'rgba(148,163,184,0.12)',fg:'#cbd5e1',bd:'rgba(148,163,184,0.22)'},
    ok:{bg:'var(--ok-bg)',fg:'#86efac',bd:'var(--ok-border)'},
    warn:{bg:'var(--warn-bg)',fg:'#fbbf24',bd:'var(--warn-border)'},
    danger:{bg:'var(--danger-bg)',fg:'#fca5a5',bd:'var(--danger-border)'},
    critical:{bg:'var(--critical-bg)',fg:'#fca5a5',bd:'rgba(220,38,38,0.5)'},
    info:{bg:'var(--info-bg)',fg:'#93c5fd',bd:'var(--info-border)'},
    delivery:{bg:'var(--delivery-bg)',fg:'#7dd3fc',bd:'var(--delivery-border)'},
    serverbot:{bg:'var(--serverbot-bg)',fg:'#c4b5fd',bd:'var(--serverbot-border)'},
    muted:{bg:'rgba(100,116,139,0.12)',fg:'var(--text-3)',bd:'rgba(100,116,139,0.22)'},
    neutral:{bg:'rgba(56,66,96,0.5)',fg:'#cbd5e1',bd:'var(--border)'},
  };
  const t = tones[tone]||tones.default;
  return <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 7px',background:t.bg,color:t.fg,border:`1px solid ${t.bd}`,borderRadius:4,fontSize:11,fontWeight:500,letterSpacing:0.1,whiteSpace:'nowrap',...style}}>{icon && <Icon name={icon} size={10}/>}{children}</span>;
};

const StatusDot = ({ status }) => {
  const c = { online:'var(--ok)', offline:'var(--danger)', degraded:'var(--warn)', pending:'var(--text-3)', past_due:'var(--warn)', unpaid:'var(--danger)', paid:'var(--ok)' }[status] || 'var(--text-3)';
  const pulse = status==='online' || status==='degraded';
  return <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:c,boxShadow:pulse?`0 0 0 3px ${c}22`:'none',flexShrink:0}}/>;
};

const Btn = ({ variant='ghost', size='sm', icon, children, onClick, disabled, style, title, danger, ...rest }) => {
  const sizes = { xs:{h:24,px:8,fs:11}, sm:{h:28,px:10,fs:12}, md:{h:34,px:14,fs:13} };
  const s = sizes[size];
  const variants = {
    primary:{bg:'var(--accent)',fg:'var(--accent-ink)',bd:'var(--accent)',hover:'#2dd4bf'},
    secondary:{bg:'var(--bg-surface-3)',fg:'var(--text)',bd:'var(--border-strong)',hover:'var(--bg-hover)'},
    ghost:{bg:'transparent',fg:'var(--text-2)',bd:'var(--border)',hover:'var(--bg-surface-2)'},
    danger:{bg:'var(--danger)',fg:'#fff',bd:'var(--danger)',hover:'#dc2626'},
    dangerGhost:{bg:'transparent',fg:'#fca5a5',bd:'var(--danger-border)',hover:'var(--danger-bg)'},
  };
  const v = variants[danger?'dangerGhost':variant]||variants.ghost;
  const [hover,setHover] = useState(false);
  return <button title={title} onClick={onClick} disabled={disabled} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} style={{height:s.h,padding:`0 ${s.px}px`,fontSize:s.fs,fontWeight:500,background:hover&&!disabled?v.hover:v.bg,color:v.fg,border:`1px solid ${v.bd}`,borderRadius:6,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,display:'inline-flex',alignItems:'center',gap:6,whiteSpace:'nowrap',transition:'all 0.1s',...style}} {...rest}>
    {icon && <Icon name={icon} size={s.fs+1}/>}
    {children}
  </button>;
};

const Card = ({ children, style, title, actions, pad=true }) => (
  <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',...style}}>
    {title && <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'1px solid var(--border)'}}>
      <div style={{fontSize:12,fontWeight:600,color:'var(--text-2)',letterSpacing:0.3,textTransform:'uppercase'}}>{title}</div>
      {actions}
    </div>}
    <div style={{padding:pad?(title?'14px':'14px'):0}}>{children}</div>
  </div>
);

const MetricCard = ({ label, value, delta, tone='default', sub, onClick }) => {
  const toneBorder = { critical:'var(--critical-bg)', danger:'var(--danger-border)', warn:'var(--warn-border)', ok:'var(--ok-border)', info:'var(--info-border)', default:'var(--border)' }[tone];
  const toneBg = tone==='default' ? 'var(--bg-surface)' : {critical:'linear-gradient(180deg, rgba(220,38,38,0.08), transparent)', danger:'linear-gradient(180deg, rgba(239,68,68,0.06), transparent)', warn:'linear-gradient(180deg, rgba(245,158,11,0.06), transparent)', ok:'linear-gradient(180deg, rgba(34,197,94,0.06), transparent)', info:'linear-gradient(180deg, rgba(96,165,250,0.06), transparent)'}[tone];
  return <div onClick={onClick} style={{background:toneBg,backgroundColor:'var(--bg-surface)',border:`1px solid ${toneBorder}`,borderRadius:'var(--r-md)',padding:'12px 14px',cursor:onClick?'pointer':'default',minWidth:0,transition:'border-color 0.15s'}} onMouseEnter={e=>onClick && (e.currentTarget.style.borderColor='var(--border-strong)')} onMouseLeave={e=>onClick && (e.currentTarget.style.borderColor=toneBorder)}>
    <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.5,fontWeight:500,marginBottom:6}}>{label}</div>
    <div style={{display:'flex',alignItems:'baseline',gap:8}}>
      <div style={{fontSize:24,fontWeight:600,fontVariantNumeric:'tabular-nums',color:tone==='critical'||tone==='danger'?'#fca5a5':tone==='warn'?'#fbbf24':tone==='ok'?'#86efac':'var(--text)'}}>{value}</div>
      {delta && <div style={{fontSize:11,color:'var(--text-3)'}}>{delta}</div>}
    </div>
    {sub && <div style={{fontSize:11,color:'var(--text-3)',marginTop:4}}>{sub}</div>}
  </div>;
};

const Table = ({ columns, rows, onRowClick, dense=false, emptyText='No data' }) => {
  return <div style={{overflow:'auto'}}>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontVariantNumeric:'tabular-nums'}}>
      <thead>
        <tr>
          {columns.map((c,i) => <th key={i} style={{textAlign:c.align||'left',padding:'8px 12px',background:'var(--bg-table-head)',borderBottom:'1px solid var(--border)',borderTop:'1px solid var(--border)',color:'var(--text-3)',fontWeight:500,fontSize:11,textTransform:'uppercase',letterSpacing:0.5,whiteSpace:'nowrap',width:c.width,position:'sticky',top:0,zIndex:1}}>{c.header}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.length===0 && <tr><td colSpan={columns.length} style={{padding:'32px',textAlign:'center',color:'var(--text-3)'}}>{emptyText}</td></tr>}
        {rows.map((r,ri) => <tr key={ri} onClick={onRowClick?(e)=>onRowClick(r,e):undefined} style={{cursor:onRowClick?'pointer':'default',borderBottom:'1px solid var(--border-subtle)'}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseLeave={e=>e.currentTarget.style.background=''}>
          {columns.map((c,ci) => <td key={ci} style={{padding:dense?'6px 12px':'9px 12px',textAlign:c.align||'left',color:'var(--text-2)',verticalAlign:'middle'}}>{c.render ? c.render(r) : r[c.key]}</td>)}
        </tr>)}
      </tbody>
    </table>
  </div>;
};

// Modal with risk confirmation
const Modal = ({ open, onClose, title, children, maxWidth=540, footer, risk }) => {
  useEffect(()=>{
    if(!open) return;
    const onKey = (e) => { if (e.key==='Escape') onClose(); };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[open,onClose]);
  if(!open) return null;
  const riskTone = { high:'var(--warn-border)', critical:'var(--critical-bg)' }[risk];
  return <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(5,10,24,0.7)',backdropFilter:'blur(4px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20,animation:'fadeIn 0.15s ease'}}>
    <div onClick={e=>e.stopPropagation()} style={{background:'var(--bg-surface)',border:`1px solid ${riskTone||'var(--border-strong)'}`,borderRadius:10,maxWidth,width:'100%',boxShadow:'var(--shadow-pop)',maxHeight:'90vh',display:'flex',flexDirection:'column',animation:'pop 0.18s cubic-bezier(0.2,0.9,0.3,1.2)'}}>
      {risk && <div style={{padding:'8px 16px',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:0.8,color:risk==='critical'?'#fca5a5':'#fbbf24',background:risk==='critical'?'var(--critical-bg)':'var(--warn-bg)',borderBottom:`1px solid ${riskTone}`,borderRadius:'10px 10px 0 0',display:'flex',alignItems:'center',gap:6}}><Icon name="alert" size={12}/>{risk==='critical'?'Confirm critical action':'Confirm high-risk action'}</div>}
      <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontSize:15,fontWeight:600}}>{title}</div>
        <button onClick={onClose} style={{background:'none',border:0,color:'var(--text-3)',cursor:'pointer',padding:4,display:'flex'}}><Icon name="x" size={16}/></button>
      </div>
      <div style={{padding:'16px 20px',overflow:'auto',flex:1}}>{children}</div>
      {footer && <div style={{padding:'12px 20px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end',gap:8,background:'var(--bg-surface-2)',borderRadius:'0 0 10px 10px'}}>{footer}</div>}
    </div>
    <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes pop{from{opacity:0;transform:translateY(8px) scale(0.98)}to{opacity:1;transform:none}}`}</style>
  </div>;
};

const TextInput = ({ value, onChange, placeholder, icon, style, size='sm', ...rest }) => {
  const sizes = { sm:{h:28,fs:12}, md:{h:34,fs:13} };
  const s = sizes[size];
  return <div style={{position:'relative',display:'flex',alignItems:'center',...style}}>
    {icon && <Icon name={icon} size={13} style={{position:'absolute',left:9,color:'var(--text-3)',pointerEvents:'none'}}/>}
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} {...rest} style={{height:s.h,paddingLeft:icon?28:10,paddingRight:10,fontSize:s.fs,width:'100%',background:'var(--bg-surface-2)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',fontFamily:'inherit',outline:'none'}} onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
  </div>;
};

const Select = ({ value, onChange, options, style, size='sm' }) => {
  const sizes = { sm:{h:28,fs:12}, md:{h:34,fs:13} };
  const s = sizes[size];
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{height:s.h,padding:'0 24px 0 10px',fontSize:s.fs,background:'var(--bg-surface-2)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',fontFamily:'inherit',cursor:'pointer',appearance:'none',backgroundImage:"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round'><polyline points='6 9 12 15 18 9'/></svg>\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 8px center',outline:'none',...style}}>
    {options.map(o => typeof o==='string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>;
};

// Delivery vs Server Bot visual separator
const RuntimeTag = ({ kind, size='sm' }) => {
  const isDelivery = kind==='delivery';
  const tone = isDelivery ? 'delivery' : 'serverbot';
  const label = isDelivery ? 'Delivery / Execute' : 'Server / Sync';
  const ic = isDelivery ? 'truck' : 'server';
  return <Badge tone={tone} icon={ic}>{label}</Badge>;
};

const RiskBadge = ({ level }) => {
  if(!level || level==='none') return <span style={{color:'var(--text-3)'}}>—</span>;
  const tones = { low:'muted', medium:'warn', high:'danger', critical:'critical' };
  return <Badge tone={tones[level]}>{level.toUpperCase()}</Badge>;
};

const StatusBadge = ({ status, icon }) => {
  const map = {
    online:{t:'ok',l:'Online'},
    offline:{t:'danger',l:'Offline'},
    degraded:{t:'warn',l:'Degraded'},
    pending:{t:'muted',l:'Pending'},
    active:{t:'ok',l:'Active'},
    paid:{t:'ok',l:'Paid'},
    unpaid:{t:'danger',l:'Unpaid'},
    past_due:{t:'warn',l:'Past Due'},
    trial:{t:'info',l:'Trial'},
    preview:{t:'info',l:'Preview'},
    suspended:{t:'muted',l:'Suspended'},
    cancelled:{t:'muted',l:'Cancelled'},
    failed:{t:'danger',l:'Failed'},
    blocked:{t:'warn',l:'Blocked'},
    dead_letter:{t:'critical',l:'Dead-letter'},
    none:{t:'muted',l:'—'},
  };
  const m = map[status]||{t:'muted',l:status};
  return <Badge tone={m.t} icon={icon}>{m.l}</Badge>;
};

Object.assign(window, { Icon, Badge, StatusDot, Btn, Card, MetricCard, Table, Modal, TextInput, Select, RuntimeTag, RiskBadge, StatusBadge });
