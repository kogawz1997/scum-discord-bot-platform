// Tenants list with filters
const Tenants = ({ onNav, initialFilter }) => {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [pkg, setPkg] = useState('all');
  const [risk, setRisk] = useState(initialFilter?.riskFilter || 'all');
  const [rtFilter, setRtFilter] = useState('all');

  const rows = useMemo(() => {
    return window.TENANTS.filter(t => {
      if (q && !(t.name.toLowerCase().includes(q.toLowerCase()) || t.slug.includes(q.toLowerCase()))) return false;
      if (status !== 'all' && t.status !== status) return false;
      if (pkg !== 'all' && t.pkg !== pkg) return false;
      if (risk !== 'all' && t.risk.level !== risk) return false;
      if (rtFilter === 'delivery_offline' && t.delivery.status !== 'offline') return false;
      if (rtFilter === 'bot_offline' && t.serverBot.status !== 'offline') return false;
      return true;
    });
  }, [q, status, pkg, risk, rtFilter]);

  const clearAll = () => { setQ(''); setStatus('all'); setPkg('all'); setRisk('all'); setRtFilter('all'); };
  const activeFilterCount = [status,pkg,risk,rtFilter].filter(v=>v!=='all').length + (q?1:0);

  return <div>
    <PageHeader
      title="Tenants"
      subtitle="Manage tenant status, packages, billing posture, and runtime readiness. Click any row to open tenant dossier."
      actions={<>
        <Btn size="sm" icon="refresh" variant="ghost">Refresh</Btn>
        <Btn size="sm" icon="plus" variant="primary">Create tenant</Btn>
      </>}
    />
    <div style={{padding:'14px 24px',borderBottom:'1px solid var(--border)',background:'var(--bg-surface)',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
      <TextInput icon="search" value={q} onChange={setQ} placeholder="Search name, slug, email…" style={{width:260}}/>
      <Select value={status} onChange={setStatus} options={[{value:'all',label:'All statuses'},{value:'active',label:'Active'},{value:'preview',label:'Preview'},{value:'suspended',label:'Suspended'}]}/>
      <Select value={pkg} onChange={setPkg} options={[{value:'all',label:'All packages'},...window.PACKAGES.map(p=>({value:p.name,label:p.name}))]}/>
      <Select value={risk} onChange={setRisk} options={[{value:'all',label:'Any risk'},{value:'low',label:'Low'},{value:'medium',label:'Medium'},{value:'high',label:'High'},{value:'critical',label:'Critical'}]}/>
      <Select value={rtFilter} onChange={setRtFilter} options={[{value:'all',label:'Any runtime'},{value:'delivery_offline',label:'Delivery offline'},{value:'bot_offline',label:'Server Bot offline'}]}/>
      {activeFilterCount>0 && <Btn size="sm" icon="x" onClick={clearAll}>Clear ({activeFilterCount})</Btn>}
      <div style={{flex:1}}/>
      <span style={{fontSize:11,color:'var(--text-3)'}}>Showing <b style={{color:'var(--text)'}}>{rows.length}</b> of {window.TENANTS.length}</span>
    </div>

    <div style={{padding:'0 24px 24px'}}>
      <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',marginTop:16}}>
        <Table
          onRowClick={(t)=>onNav('tenant-detail',{tenantId:t.id})}
          columns={[
            { header:'Tenant', render: t => <div style={{display:'flex',alignItems:'center',gap:10}}>
              <StatusDot status={t.status==='active'?'online':t.status==='suspended'?'offline':'pending'}/>
              <div><div style={{fontWeight:500,color:'var(--text)'}}>{t.name}</div><div className="mono" style={{fontSize:10.5,color:'var(--text-muted)'}}>{t.slug} · {t.locale.toUpperCase()}</div></div>
            </div>},
            { header:'Status', render: t => <StatusBadge status={t.status}/> },
            { header:'Package', render: t => <Badge tone={t.pkg==='Enterprise'?'info':t.pkg==='Pro'?'ok':'muted'} icon="pkg">{t.pkg}</Badge> },
            { header:'Subscription', render: t => <div><StatusBadge status={t.sub.status==='active'?'active':t.sub.status==='past_due'?'past_due':t.sub.status==='trial'?'trial':t.sub.status==='cancelled'?'cancelled':'none'}/><div style={{fontSize:10.5,color:'var(--text-3)',marginTop:2}}>{t.sub.renewsAt?`renew ${t.sub.renewsAt}`:t.sub.trialEnd?`trial → ${t.sub.trialEnd}`:'—'}</div></div> },
            { header:'Delivery', render: t => <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}><Icon name={t.delivery.status==='online'?'wifi':'wifiOff'} size={12} style={{color:t.delivery.status==='online'?'var(--ok)':t.delivery.status==='offline'?'var(--danger)':'var(--text-3)'}}/><div><div style={{color:'var(--text-2)'}}>{t.delivery.status}</div><div className="mono" style={{fontSize:10,color:'var(--text-muted)'}}>v{t.delivery.version}</div></div></div> },
            { header:'Server Bot', render: t => <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}><Icon name={t.serverBot.status==='online'?'wifi':'wifiOff'} size={12} style={{color:t.serverBot.status==='online'?'var(--ok)':t.serverBot.status==='offline'?'var(--danger)':t.serverBot.status==='degraded'?'var(--warn)':'var(--text-3)'}}/><div><div style={{color:'var(--text-2)'}}>{t.serverBot.status}</div><div className="mono" style={{fontSize:10,color:'var(--text-muted)'}}>v{t.serverBot.version}</div></div></div> },
            { header:'Billing', render: t => <StatusBadge status={t.billing.status==='none'?'none':t.billing.status}/> },
            { header:'Risk', render: t => <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'flex-start'}}>{t.risk.badges.length===0 ? <Badge tone="muted">healthy</Badge> : t.risk.badges.slice(0,2).map((b,i)=><Badge key={i} tone={b.includes('Offline')||b.includes('Failed')?'danger':b.includes('Suspended')?'muted':'warn'}>{b}</Badge>)}{t.risk.badges.length>2 && <span style={{fontSize:10,color:'var(--text-3)'}}>+{t.risk.badges.length-2} more</span>}</div> },
            { header:'Activity', render: t => <span style={{fontSize:11,color:'var(--text-3)'}}>{t.players} players</span> },
            { header:'', width:40, render: t => <Icon name="chevronRight" size={14} style={{color:'var(--text-muted)'}}/> },
          ]}
          rows={rows}
          emptyText="No tenants match the current filters."
        />
      </div>
    </div>
  </div>;
};
window.Tenants = Tenants;
