// Runtime Health — fleet view for Delivery Agents + Server Bots
const Runtime = ({ onNav }) => {
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [version, setVersion] = useState('all');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    return window.FLEET.filter(r => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (status !== 'all' && r.status !== status) return false;
      if (version === 'outdated' && r.version === r.latestVersion) return false;
      if (version === 'latest' && r.version !== r.latestVersion) return false;
      if (q && !(r.tenantName.toLowerCase().includes(q.toLowerCase()) || (r.machine||'').toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [kind, status, version, q]);

  const R = window.DASHBOARD.runtime;

  return <div>
    <PageHeader
      title="Runtime Health"
      subtitle="Combined fleet of Delivery Agents and Server Bots across all tenants. Each row is an individual runtime instance."
      actions={<>
        <Btn size="sm" icon="refresh" variant="ghost">Refresh</Btn>
        <Btn size="sm" icon="list" variant="secondary">Version drift report</Btn>
      </>}
    />
    <div style={{padding:'16px 24px 0'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5, 1fr)',gap:12,marginBottom:16}}>
        <MetricCard label="Delivery Agents online" value={`${R.deliveryOnline} / ${R.deliveryOnline+R.deliveryOffline}`} tone="info"/>
        <MetricCard label="Delivery offline" value={R.deliveryOffline} tone={R.deliveryOffline>0?'warn':'default'}/>
        <MetricCard label="Server Bots online" value={`${R.botOnline} / ${R.botOnline+R.botOffline}`} tone="info"/>
        <MetricCard label="Server Bot offline" value={R.botOffline} tone={R.botOffline>0?'danger':'default'} sub="restart + config blocked"/>
        <MetricCard label="Outdated runtimes" value={R.outdated} tone="warn" sub="not on v1.8.2"/>
      </div>
    </div>
    <div style={{padding:'0 24px 14px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',borderBottom:'1px solid var(--border)'}}>
      <TextInput icon="search" value={q} onChange={setQ} placeholder="Search tenant or machine…" style={{width:260}}/>
      <Select value={kind} onChange={setKind} options={[{value:'all',label:'All runtimes'},{value:'delivery',label:'Delivery Agent'},{value:'server_bot',label:'Server Bot'}]}/>
      <Select value={status} onChange={setStatus} options={[{value:'all',label:'Any status'},{value:'online',label:'Online'},{value:'offline',label:'Offline'},{value:'degraded',label:'Degraded'},{value:'pending',label:'Pending'}]}/>
      <Select value={version} onChange={setVersion} options={[{value:'all',label:'Any version'},{value:'outdated',label:'Outdated only'},{value:'latest',label:'Latest only'}]}/>
      <div style={{flex:1}}/>
      <span style={{fontSize:11,color:'var(--text-3)'}}>{rows.length} runtimes</span>
    </div>
    <div style={{padding:'16px 24px 24px'}}>
      <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden'}}>
        <Table
          onRowClick={r=>onNav('tenant-detail',{tenantId:r.tenantId})}
          columns={[
            { header:'Runtime', render: r => <div style={{display:'flex',alignItems:'center',gap:8}}>
              <RuntimeTag kind={r.kind}/>
              <span className="mono" style={{fontSize:11,color:'var(--text-3)'}}>{r.id}</span>
            </div>},
            { header:'Tenant', render: r => <span style={{color:'var(--text)'}}>{r.tenantName}</span>},
            { header:'Machine', render: r => <span className="mono" style={{color:'var(--text-2)'}}>{r.machine || '—'}</span>},
            { header:'Status', render: r => <StatusBadge status={r.status}/>},
            { header:'Version', render: r => <div style={{display:'flex',alignItems:'center',gap:6}}><span className="mono">{r.version}</span>{r.version !== r.latestVersion && r.version !== '—' && <Badge tone="warn">outdated</Badge>}</div>},
            { header:'Heartbeat', render: r => <span style={{color:r.status==='offline'?'#fca5a5':'var(--text-2)',fontSize:11}}>{r.lastSeen?window.fmtTime(r.lastSeen):'—'}</span>},
            { header:'Scope', render: r => <Badge tone={r.kind==='delivery'?'delivery':'serverbot'}>{r.scope}</Badge>},
            { header:'', width:90, render: r => <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}><Btn size="xs">Logs</Btn></div> },
          ]}
          rows={rows}
          emptyText="No runtimes match."
        />
      </div>
    </div>
  </div>;
};
window.Runtime = Runtime;
