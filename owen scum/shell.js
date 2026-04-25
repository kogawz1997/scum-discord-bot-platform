// App Shell: sidebar + topbar

const NAV = [
  { group:'Platform', items:[
    { id:'overview', label:'Overview', icon:'grid' },
    { id:'tenants', label:'Tenants', icon:'users', badge:'12' },
    { id:'packages', label:'Packages', icon:'pkg' },
    { id:'subscriptions', label:'Subscriptions', icon:'layers' },
    { id:'billing', label:'Billing', icon:'file', badge:'2', badgeTone:'warn' },
  ]},
  { group:'Operations', items:[
    { id:'runtime', label:'Runtime Health', icon:'radio', badge:'3', badgeTone:'danger' },
    { id:'agents', label:'Agents & Bots', icon:'bot' },
    { id:'jobs', label:'Jobs & Queues', icon:'activity' },
    { id:'config', label:'Config Jobs', icon:'settings' },
    { id:'restart', label:'Restart Plans', icon:'refresh' },
    { id:'backups', label:'Backups', icon:'server' },
    { id:'incidents', label:'Incidents', icon:'alert', badge:'1', badgeTone:'warn' },
    { id:'support', label:'Support', icon:'lifebuoy' },
    { id:'diagnostics', label:'Diagnostics', icon:'list' },
  ]},
  { group:'Governance', items:[
    { id:'audit', label:'Audit Logs', icon:'file' },
    { id:'security', label:'Security Events', icon:'shield' },
    { id:'access', label:'Access Control', icon:'lock' },
    { id:'settings', label:'Settings', icon:'settings' },
  ]},
];

const Sidebar = ({ current, onNav }) => {
  return <aside style={{width:'var(--sidebar-w)',background:'var(--bg-surface)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',height:'100vh',position:'sticky',top:0,flexShrink:0}}>
    <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10}}>
      <div style={{width:28,height:28,background:'linear-gradient(135deg, var(--accent), var(--accent-2))',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--accent-ink)',fontWeight:700,fontSize:13,fontFamily:'JetBrains Mono'}}>OW</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:600,letterSpacing:0.2}}>Owen Panel</div>
        <div style={{fontSize:10,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.6}}>SCUM Platform · v2</div>
      </div>
    </div>
    <nav style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
      {NAV.map(group => <div key={group.group} style={{marginBottom:14}}>
        <div style={{padding:'6px 18px 4px',fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1,fontWeight:600}}>{group.group}</div>
        {group.items.map(it => {
          const active = current===it.id;
          return <button key={it.id} onClick={()=>onNav(it.id)} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'7px 18px',background:active?'var(--bg-surface-3)':'transparent',border:0,borderLeft:`2px solid ${active?'var(--accent)':'transparent'}`,color:active?'var(--text)':'var(--text-2)',cursor:'pointer',fontSize:12.5,fontWeight:active?500:400,fontFamily:'inherit',textAlign:'left',transition:'background 0.1s'}} onMouseEnter={e=>!active && (e.currentTarget.style.background='var(--bg-surface-2)')} onMouseLeave={e=>!active && (e.currentTarget.style.background='transparent')}>
            <Icon name={it.icon} size={14} style={{color:active?'var(--accent)':'var(--text-3)',flexShrink:0}}/>
            <span style={{flex:1}}>{it.label}</span>
            {it.badge && <span style={{fontSize:10,padding:'1px 6px',borderRadius:10,background:it.badgeTone==='danger'?'var(--danger-bg)':it.badgeTone==='warn'?'var(--warn-bg)':'rgba(148,163,184,0.12)',color:it.badgeTone==='danger'?'#fca5a5':it.badgeTone==='warn'?'#fbbf24':'var(--text-3)',fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{it.badge}</span>}
          </button>;
        })}
      </div>)}
    </nav>
    <div style={{padding:'10px 14px',borderTop:'1px solid var(--border)',background:'var(--bg-surface-2)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg, #f59e0b, #ef4444)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff'}}>OW</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>Owen Scum</div>
          <div style={{fontSize:10,color:'var(--text-3)'}}>Platform Owner</div>
        </div>
        <Icon name="settings" size={13} style={{color:'var(--text-3)',cursor:'pointer'}}/>
      </div>
    </div>
  </aside>;
};

const TopBar = ({ onNav }) => {
  const [q, setQ] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  const results = useMemo(() => {
    if(!q.trim()) return [];
    const lc = q.toLowerCase();
    return window.TENANTS.filter(t => t.name.toLowerCase().includes(lc) || t.slug.includes(lc) || t.ownerEmail.includes(lc)).slice(0,5);
  }, [q]);

  return <header style={{height:'var(--topbar-h)',background:'var(--bg-surface)',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',padding:'0 16px',gap:14,position:'sticky',top:0,zIndex:50}}>
    {/* Global search */}
    <div style={{position:'relative',flex:'0 1 460px'}}>
      <TextInput icon="search" value={q} onChange={setQ} placeholder="Search tenants, invoices, agents, audit events…" onFocus={()=>setShowResults(true)} onBlur={()=>setTimeout(()=>setShowResults(false),150)}/>
      {showResults && q && <div style={{position:'absolute',top:34,left:0,right:0,background:'var(--bg-surface)',border:'1px solid var(--border-strong)',borderRadius:8,boxShadow:'var(--shadow-pop)',maxHeight:360,overflow:'auto',zIndex:100}}>
        {results.length===0 && <div style={{padding:16,color:'var(--text-3)',fontSize:12,textAlign:'center'}}>No matches</div>}
        {results.map(t => <div key={t.id} onClick={()=>{onNav('tenant-detail',{tenantId:t.id});setQ('');setShowResults(false);}} style={{padding:'9px 12px',display:'flex',alignItems:'center',gap:10,cursor:'pointer',borderBottom:'1px solid var(--border-subtle)'}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseLeave={e=>e.currentTarget.style.background=''}>
          <StatusDot status={t.status==='active'?'online':'offline'}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:500}}>{t.name}</div>
            <div style={{fontSize:11,color:'var(--text-3)',fontFamily:'JetBrains Mono'}}>{t.slug}</div>
          </div>
          <Badge tone="muted">{t.pkg}</Badge>
        </div>)}
      </div>}
    </div>

    {/* Platform status pill */}
    <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',background:'var(--warn-bg)',border:'1px solid var(--warn-border)',borderRadius:6,fontSize:11,color:'#fbbf24',fontWeight:500}}>
      <StatusDot status="degraded"/>
      Platform: Degraded
    </div>

    {/* Runtime summary */}
    <div style={{display:'flex',alignItems:'center',gap:14,fontSize:11,color:'var(--text-3)',fontVariantNumeric:'tabular-nums'}}>
      <span><Icon name="truck" size={12} style={{color:'var(--delivery)',marginRight:4,verticalAlign:-1}}/>{window.DASHBOARD.runtime.deliveryOnline}/{window.DASHBOARD.runtime.deliveryOnline+window.DASHBOARD.runtime.deliveryOffline} delivery</span>
      <span><Icon name="server" size={12} style={{color:'var(--serverbot)',marginRight:4,verticalAlign:-1}}/>{window.DASHBOARD.runtime.botOnline}/{window.DASHBOARD.runtime.botOnline+window.DASHBOARD.runtime.botOffline} server bots</span>
    </div>

    <div style={{flex:1}}/>

    {/* Env + actions */}
    <Badge tone="warn" icon="dot" style={{fontWeight:600}}>PRODUCTION</Badge>
    <Btn size="sm" icon="plus" variant="secondary">Quick Action</Btn>

    {/* Locale */}
    <div style={{display:'flex',border:'1px solid var(--border)',borderRadius:6,overflow:'hidden',fontSize:11}}>
      <button style={{padding:'4px 8px',background:'var(--bg-surface-3)',border:0,color:'var(--text)',cursor:'pointer',fontFamily:'inherit'}}>EN</button>
      <button style={{padding:'4px 8px',background:'transparent',border:0,borderLeft:'1px solid var(--border)',color:'var(--text-3)',cursor:'pointer',fontFamily:'inherit'}}>TH</button>
    </div>

    {/* Notifications */}
    <div style={{position:'relative'}}>
      <button onClick={()=>setShowNotifs(!showNotifs)} style={{width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'1px solid var(--border)',borderRadius:6,color:'var(--text-2)',cursor:'pointer',position:'relative'}}>
        <Icon name="bell" size={14}/>
        <span style={{position:'absolute',top:-4,right:-4,background:'var(--danger)',color:'#fff',fontSize:9,padding:'1px 5px',borderRadius:10,fontWeight:700,minWidth:16,textAlign:'center'}}>{window.NOTIFS.length}</span>
      </button>
      {showNotifs && <div style={{position:'absolute',top:36,right:0,width:380,background:'var(--bg-surface)',border:'1px solid var(--border-strong)',borderRadius:8,boxShadow:'var(--shadow-pop)',zIndex:100}}>
        <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:12,fontWeight:600}}>Notifications</div>
          <span style={{fontSize:11,color:'var(--text-3)'}}>{window.NOTIFS.length} unread</span>
        </div>
        <div style={{maxHeight:400,overflow:'auto'}}>
          {window.NOTIFS.map(n => {
            const sevMap = { critical:{c:'#fca5a5',bg:'var(--critical-bg)'}, high:{c:'#fca5a5',bg:'var(--danger-bg)'}, medium:{c:'#fbbf24',bg:'var(--warn-bg)'}, low:{c:'#93c5fd',bg:'var(--info-bg)'} }[n.severity];
            return <div key={n.id} onClick={()=>{setShowNotifs(false);n.tenantId&&onNav('tenant-detail',{tenantId:n.tenantId});}} style={{padding:'10px 14px',borderBottom:'1px solid var(--border-subtle)',cursor:'pointer',display:'flex',gap:10}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseLeave={e=>e.currentTarget.style.background=''}>
              <div style={{width:8,height:8,borderRadius:'50%',background:sevMap.c,marginTop:6,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:500,marginBottom:2}}>{n.title}</div>
                <div style={{fontSize:11,color:'var(--text-3)',lineHeight:1.4}}>{n.body}</div>
                <div style={{fontSize:10,color:'var(--text-muted)',marginTop:4,textTransform:'uppercase',letterSpacing:0.3}}>{n.type} · {window.fmtTime(n.at)}</div>
              </div>
            </div>;
          })}
        </div>
      </div>}
    </div>
  </header>;
};

const PageHeader = ({ title, subtitle, actions, breadcrumb }) => (
  <div style={{padding:'18px 24px 14px',borderBottom:'1px solid var(--border)',background:'var(--bg-surface)'}}>
    {breadcrumb && <div style={{fontSize:11,color:'var(--text-3)',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>{breadcrumb}</div>}
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:20}}>
      <div>
        <h1 style={{margin:0,fontSize:20,fontWeight:600,letterSpacing:-0.2}}>{title}</h1>
        {subtitle && <div style={{fontSize:12.5,color:'var(--text-3)',marginTop:4,maxWidth:720}}>{subtitle}</div>}
      </div>
      {actions && <div style={{display:'flex',gap:8,flexShrink:0}}>{actions}</div>}
    </div>
  </div>
);

Object.assign(window, { Sidebar, TopBar, PageHeader });
