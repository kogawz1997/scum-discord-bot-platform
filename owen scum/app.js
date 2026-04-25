// Main app: router + root + cross-cutting screens

const RiskConfirmModal = ({ open, onClose, cfg, onConfirm }) => {
  const [phrase, setPhrase] = useState('');
  useEffect(() => { if(open) setPhrase(''); }, [open]);
  if (!cfg) return null;
  const phraseOk = !cfg.confirmPhrase || phrase === cfg.confirmPhrase;

  return <Modal open={open} onClose={onClose} title={cfg.title} risk={cfg.risk} maxWidth={520} footer={
    <>
      <div style={{flex:1}}/>
      <Btn size="sm" onClick={onClose}>Cancel</Btn>
      <Btn size="sm" danger disabled={!phraseOk || cfg.disabled} onClick={() => { onConfirm && onConfirm(); onClose(); }}>{cfg.confirmLabel || 'Confirm'}</Btn>
    </>
  }>
    {cfg.body}
    {cfg.confirmPhrase && <div style={{marginTop:14}}>
      <div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>Type <code style={{color:'var(--text)',background:'var(--bg-surface-2)',padding:'1px 6px',borderRadius:3}}>{cfg.confirmPhrase}</code> to confirm</div>
      <TextInput value={phrase} onChange={setPhrase} placeholder={cfg.confirmPhrase}/>
    </div>}
  </Modal>;
};

// ---------- Simple cross-cutting screens ----------

const Billing = ({ onNav }) => {
  const unpaid = window.TENANTS.filter(t => t.billing.status === 'unpaid');
  const rows = window.TENANTS.flatMap(t => {
    if (t.billing.status === 'unpaid') {
      return [{tenantId:t.id, tenant:t.name, id:t.billing.latestInvoice||'inv_x', amount:t.sub.mrr, status:'unpaid', due:'Apr 22', attempt:'card_declined · 2h ago'}];
    }
    if (t.sub.status === 'active' && t.sub.mrr) {
      return [{tenantId:t.id, tenant:t.name, id:`inv_${t.id.slice(-3)}_04`, amount:t.sub.mrr, status:'paid', due:'Apr 01', attempt:'—'}];
    }
    return [];
  });
  return <div>
    <PageHeader title="Billing" subtitle="Invoices, payment retries, and revenue posture across all tenants." actions={<Btn size="sm" icon="refresh">Run retry cycle</Btn>}/>
    <div style={{padding:'18px 24px 0',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
      <MetricCard label="MRR" value={`฿${window.DASHBOARD.revenue.mrr.toLocaleString()}`} tone="ok" sub={`${window.DASHBOARD.revenue.activeSubscriptions} active subs`}/>
      <MetricCard label="Unpaid invoices" value={window.DASHBOARD.revenue.unpaidInvoices} tone="danger"/>
      <MetricCard label="Failed payments" value={window.DASHBOARD.revenue.failedPayments} tone="warn"/>
      <MetricCard label="Trials ending" value={window.DASHBOARD.revenue.trialEndingSoon} tone="info"/>
    </div>
    <div style={{padding:24}}>
      <Card title="Invoices" pad={false}>
        <Table
          onRowClick={r=>onNav('tenant-detail',{tenantId:r.tenantId})}
          columns={[
            {header:'Invoice',render:r=><span className="mono">{r.id}</span>},
            {header:'Tenant',render:r=>r.tenant},
            {header:'Amount',align:'right',render:r=><span className="mono">฿{r.amount.toLocaleString()}</span>},
            {header:'Status',render:r=><StatusBadge status={r.status}/>},
            {header:'Due',render:r=>r.due},
            {header:'Last attempt',render:r=><span style={{fontSize:11,color:'var(--text-3)'}}>{r.attempt}</span>},
            {header:'',render:r=>r.status==='unpaid' ? <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}><Btn size="xs" variant="primary">Retry</Btn><Btn size="xs">Mark paid</Btn></div> : null},
          ]}
          rows={rows}
        />
      </Card>
    </div>
  </div>;
};

const Jobs = ({ onNav }) => <div>
  <PageHeader title="Jobs & Queues" subtitle="All runtime jobs across Delivery Agents and Server Bots — config, restart, backup, delivery." actions={<Btn size="sm" icon="refresh">Refresh</Btn>}/>
  <div style={{padding:24}}>
    <Card title={`${window.JOBS.length} recent jobs`} pad={false}>
      <Table
        onRowClick={j=>onNav('tenant-detail',{tenantId:j.tenantId})}
        columns={[
          {header:'Job',render:j=><span className="mono">{j.id}</span>},
          {header:'Tenant',render:j=>{const t=window.TENANTS.find(x=>x.id===j.tenantId);return t?.name||j.tenantId;}},
          {header:'Type',render:j=><span className="mono">{j.type}</span>},
          {header:'Runtime',render:j=><RuntimeTag kind={j.type.startsWith('delivery')?'delivery':'server_bot'}/>},
          {header:'Status',render:j=><StatusBadge status={j.status}/>},
          {header:'Attempts',render:j=><span className="mono">{j.attempts||1}</span>},
          {header:'Created',render:j=><span style={{color:'var(--text-3)'}}>{window.fmtTime(j.at)}</span>},
          {header:'',render:j=>j.retryable?<Btn size="xs" variant="primary">Retry</Btn>:null},
        ]}
        rows={window.JOBS}
      />
    </Card>
  </div>
</div>;

const Audit = () => <div>
  <PageHeader title="Audit Logs" subtitle="Every sensitive operation across the platform. Immutable."/>
  <div style={{padding:24}}>
    <Card pad={false}>
      <Table
        columns={[
          {header:'Time',render:a=><span style={{color:'var(--text-3)'}}>{window.fmtTime(a.at)}</span>},
          {header:'Actor',render:a=>a.actor},
          {header:'Action',render:a=><span className="mono">{a.action}</span>},
          {header:'Target',render:a=><span className="mono" style={{color:'var(--text-3)'}}>{a.target}</span>},
          {header:'Risk',render:a=><RiskBadge level={a.risk}/>},
          {header:'Result',render:a=><StatusBadge status={a.result==='success'?'online':a.result==='failed'?'failed':a.result==='blocked'?'blocked':'degraded'}/>},
        ]}
        rows={[...window.AUDIT_FOR('t_bkk'),...window.AUDIT_FOR('t_pnx')]}
      />
    </Card>
  </div>
</div>;

const Security = () => <div>
  <PageHeader title="Security Events" subtitle="Setup token usage, auth anomalies, credential events."/>
  <div style={{padding:24}}>
    <Card pad={false}>
      <Table
        columns={[
          {header:'Time',render:s=><span style={{color:'var(--text-3)'}}>{window.fmtTime(s.at)}</span>},
          {header:'Event',render:s=>s.type},
          {header:'Severity',render:s=><RiskBadge level={s.severity}/>},
          {header:'Tenant',render:s=>{const t=window.TENANTS.find(x=>x.id===s.tenantId);return t?.name||'—';}},
          {header:'Source IP',render:s=><span className="mono">{s.ip}</span>},
          {header:'',render:()=><div style={{display:'flex',gap:4,justifyContent:'flex-end'}}><Btn size="xs">Investigate</Btn></div>},
        ]}
        rows={window.SECURITY}
      />
    </Card>
  </div>
</div>;

const Incidents = () => <div>
  <PageHeader title="Incidents" subtitle="Platform-wide issues affecting multiple tenants or core services."/>
  <div style={{padding:24}}>
    <Card pad={false}>
      <Table
        columns={[
          {header:'Incident',render:i=><div><div style={{fontWeight:500}}>{i.title}</div><div className="mono" style={{fontSize:11,color:'var(--text-3)'}}>{i.id}</div></div>},
          {header:'Severity',render:i=><RiskBadge level={i.severity}/>},
          {header:'Status',render:i=><Badge tone={i.status==='investigating'?'warn':'info'}>{i.status}</Badge>},
          {header:'Started',render:i=><span style={{color:'var(--text-3)'}}>{window.fmtTime(i.startedAt)}</span>},
          {header:'',render:()=><Btn size="xs">View</Btn>},
        ]}
        rows={window.INCIDENTS}
      />
    </Card>
  </div>
</div>;

const Packages = () => <div>
  <PageHeader title="Packages" subtitle="Subscription tiers available to tenants." actions={<Btn size="sm" icon="plus" variant="primary">New package</Btn>}/>
  <div style={{padding:24,display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:12}}>
    {window.PACKAGES.map(p => <div key={p.id} style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:8,padding:16}}>
      <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.6,fontWeight:600,marginBottom:4}}>{p.name}</div>
      <div style={{fontSize:22,fontWeight:600,marginBottom:6}}>฿{p.price.toLocaleString()}<span style={{fontSize:11,color:'var(--text-3)',fontWeight:400}}> /mo</span></div>
      <div style={{fontSize:11.5,color:'var(--text-3)',marginBottom:10}}>{p.tenants} tenant{p.tenants>1?'s':''} subscribed</div>
      <div style={{display:'flex',gap:6}}><Btn size="xs">Edit</Btn><Btn size="xs">View tenants</Btn></div>
    </div>)}
  </div>
</div>;

const Placeholder = ({ label }) => <div>
  <PageHeader title={label} subtitle="This screen follows the same pattern as the others — filters, metric row, primary table, detail drawer."/>
  <div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>
    <div style={{fontSize:13,marginBottom:6}}>{label} screen — wireframe only in this prototype.</div>
    <div style={{fontSize:11.5}}>Navigate to Overview, Tenants, Runtime Health, or Agents & Bots to see fully rendered screens.</div>
  </div>
</div>;

// ---------- Root ----------

const App = () => {
  const [route, setRoute] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ownerRoute')) || { page:'overview', params:{} }; }
    catch { return { page:'overview', params:{} }; }
  });
  const [confirmCfg, setConfirmCfg] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(() => ()=>{});

  useEffect(() => { localStorage.setItem('ownerRoute', JSON.stringify(route)); }, [route]);

  const nav = (page, params={}) => setRoute({ page, params });

  const openConfirm = (cfg) => {
    setConfirmCfg(cfg);
    setConfirmOpen(true);
  };

  const screens = {
    overview: <Overview onNav={nav}/>,
    tenants: <Tenants onNav={nav}/>,
    'tenant-detail': <TenantDetail tenantId={route.params.tenantId} onNav={nav} onConfirm={openConfirm}/>,
    runtime: <Runtime onNav={nav}/>,
    agents: <Agents onNav={nav}/>,
    billing: <Billing onNav={nav}/>,
    jobs: <Jobs onNav={nav}/>,
    audit: <Audit/>,
    security: <Security/>,
    incidents: <Incidents/>,
    packages: <Packages/>,
    subscriptions: <Placeholder label="Subscriptions"/>,
    config: <Placeholder label="Config Jobs"/>,
    restart: <Placeholder label="Restart Plans"/>,
    backups: <Placeholder label="Backups"/>,
    support: <Placeholder label="Support"/>,
    diagnostics: <Placeholder label="Diagnostics"/>,
    access: <Placeholder label="Access Control"/>,
    settings: <Placeholder label="Settings"/>,
  };

  const currentNav = route.page === 'tenant-detail' ? 'tenants' : route.page;

  return <div style={{display:'flex',minHeight:'100vh'}}>
    <Sidebar current={currentNav} onNav={nav}/>
    <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
      <TopBar onNav={nav}/>
      <main style={{flex:1}}>{screens[route.page] || <Placeholder label="Not found"/>}</main>
    </div>
    <RiskConfirmModal open={confirmOpen} onClose={()=>setConfirmOpen(false)} cfg={confirmCfg} onConfirm={()=>{}}/>
  </div>;
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
