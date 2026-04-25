// Tenant Detail / Dossier
const TenantDetail = ({ tenantId, onNav, onConfirm }) => {
  const t = window.TENANTS.find(x => x.id === tenantId) || window.TENANTS[0];
  const [tab, setTab] = useState('summary');

  const TABS = ['summary','subscription','billing','agents','config','restart','backups','support','audit','diagnostics'];
  const audit = window.AUDIT_FOR(t.id);
  const failedJobs = window.JOBS.filter(j => j.tenantId === t.id);

  const handleSuspend = () => onConfirm({
    title:`Suspend ${t.name}?`, risk:'critical',
    body:<>
      <div style={{marginBottom:12,color:'var(--text-2)',fontSize:12.5,lineHeight:1.5}}>This will block tenant operations, runtime actions, and player access depending on policy.</div>
      <div style={{background:'var(--bg-surface-2)',border:'1px solid var(--border)',borderRadius:6,padding:12,marginBottom:12}}>
        <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.5,marginBottom:8,fontWeight:600}}>Impact</div>
        <ul style={{margin:0,paddingLeft:18,fontSize:12,color:'var(--text-2)',lineHeight:1.7}}>
          <li>Delivery Agent will stop processing new jobs</li>
          <li>Server Bot will stop syncing logs and config</li>
          <li>Player portal access will be restricted</li>
          <li>Active subscription will remain billable unless cancelled</li>
        </ul>
      </div>
    </>,
    confirmPhrase: t.slug,
    confirmLabel:'Suspend tenant',
  });

  return <div>
    {/* Header */}
    <div style={{padding:'16px 24px 0',background:'var(--bg-surface)',borderBottom:'1px solid var(--border)'}}>
      <div style={{fontSize:11,color:'var(--text-3)',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
        <button onClick={()=>onNav('tenants')} style={{background:0,border:0,color:'var(--text-3)',cursor:'pointer',padding:0,fontFamily:'inherit'}}>Tenants</button>
        <Icon name="chevronRight" size={10}/>
        <span style={{color:'var(--text-2)'}}>{t.name}</span>
      </div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:20,marginBottom:14}}>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
            <StatusDot status={t.status==='active'?'online':'offline'}/>
            <h1 style={{margin:0,fontSize:22,fontWeight:600}}>{t.name}</h1>
            <StatusBadge status={t.status}/>
            <RiskBadge level={t.risk.level}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:18,fontSize:12,color:'var(--text-3)'}}>
            <span className="mono">{t.slug}</span>
            <span>{t.ownerName} · {t.ownerEmail}</span>
            <span>Locale {t.locale.toUpperCase()}</span>
            <span>Created {t.createdAt}</span>
            <span>{t.players} players online</span>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <Btn size="sm" icon="list" variant="secondary">Run diagnostics</Btn>
          <Btn size="sm" icon="lifebuoy" variant="secondary">New support case</Btn>
          <Btn size="sm" icon="alert" danger onClick={handleSuspend}>Suspend</Btn>
        </div>
      </div>
      {/* Risk banner if any */}
      {t.risk.badges.length>0 && t.risk.level!=='low' && <div style={{background:t.risk.level==='high'||t.risk.level==='critical'?'var(--danger-bg)':'var(--warn-bg)',border:`1px solid ${t.risk.level==='high'||t.risk.level==='critical'?'var(--danger-border)':'var(--warn-border)'}`,borderRadius:6,padding:'8px 12px',marginBottom:14,display:'flex',alignItems:'center',gap:10,fontSize:12}}>
        <Icon name="alert" size={14} style={{color:t.risk.level==='high'||t.risk.level==='critical'?'#fca5a5':'#fbbf24'}}/>
        <div style={{flex:1}}>{t.risk.badges.join(' · ')}</div>
      </div>}
      {/* Tabs */}
      <div style={{display:'flex',gap:2,overflowX:'auto'}}>
        {TABS.map(id => <button key={id} onClick={()=>setTab(id)} style={{padding:'9px 14px',background:'transparent',border:0,borderBottom:`2px solid ${tab===id?'var(--accent)':'transparent'}`,color:tab===id?'var(--text)':'var(--text-3)',fontSize:12.5,fontWeight:tab===id?600:400,cursor:'pointer',fontFamily:'inherit',textTransform:'capitalize',whiteSpace:'nowrap'}}>{id==='agents'?'Agents & Bots':id}</button>)}
      </div>
    </div>

    {/* Content */}
    <div style={{padding:'20px 24px'}}>
      {tab==='summary' && <SummaryTab t={t} onConfirm={onConfirm} audit={audit}/>}
      {tab==='agents' && <AgentsTab t={t} onConfirm={onConfirm}/>}
      {tab==='subscription' && <SubscriptionTab t={t}/>}
      {tab==='billing' && <BillingTab t={t} onConfirm={onConfirm}/>}
      {tab==='config' && <ConfigTab t={t} failedJobs={failedJobs}/>}
      {tab==='restart' && <RestartTab t={t} onConfirm={onConfirm}/>}
      {tab==='backups' && <BackupsTab t={t}/>}
      {tab==='support' && <SupportTab t={t}/>}
      {tab==='audit' && <AuditTab audit={audit}/>}
      {tab==='diagnostics' && <DiagnosticsTab t={t}/>}
    </div>
  </div>;
};

const SummaryTab = ({ t, onConfirm, audit }) => (
  <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:12,marginBottom:16}}>
    <MetricCard label="Subscription" value={t.sub.status} tone={t.sub.status==='active'?'ok':t.sub.status==='past_due'?'warn':'default'} sub={t.pkg+' · '+(t.sub.mrr?`฿${t.sub.mrr.toLocaleString()}/mo`:'free')}/>
    <MetricCard label="Billing" value={t.billing.status==='none'?'—':t.billing.status} tone={t.billing.status==='paid'?'ok':t.billing.status==='unpaid'?'danger':'default'} sub={t.billing.failedCount>0?`${t.billing.failedCount} failed attempts`:'No failed payments'}/>
    <MetricCard label="Delivery Agent" value={t.delivery.status} tone={t.delivery.status==='online'?'ok':'danger'} sub={t.delivery.machine?`${t.delivery.machine} · v${t.delivery.version}`:'not activated'}/>
    <MetricCard label="Server Bot" value={t.serverBot.status} tone={t.serverBot.status==='online'?'ok':t.serverBot.status==='degraded'?'warn':'danger'} sub={t.serverBot.machine?`${t.serverBot.machine} · v${t.serverBot.version}`:'not activated'}/>
    <div style={{gridColumn:'1 / -1'}}>
      <Card title="Recent activity" pad={false}>
        <div>
          {audit.slice(0,5).map(a => <div key={a.id} style={{padding:'10px 14px',borderBottom:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',gap:10,fontSize:12}}>
            <span style={{width:70,color:'var(--text-3)',fontSize:11}}>{window.fmtTime(a.at)}</span>
            <span style={{width:120,color:'var(--text-2)'}}>{a.actor}</span>
            <span className="mono" style={{flex:1,color:'var(--text)'}}>{a.action}</span>
            <RiskBadge level={a.risk}/>
            <StatusBadge status={a.result==='success'?'online':a.result==='failed'?'failed':a.result==='blocked'?'blocked':'degraded'}/>
          </div>)}
        </div>
      </Card>
    </div>
  </div>
);

const AgentsTab = ({ t, onConfirm }) => {
  const rotate = () => onConfirm({
    title:'Rotate Server Bot credential?', risk:'high',
    body:<div style={{fontSize:12.5,color:'var(--text-2)',lineHeight:1.5}}>This will invalidate the current credential. The Server Bot will disconnect and must be re-activated with a new setup token. Server config apply, backup, and restart will be blocked until re-activated.</div>,
    confirmLabel:'Rotate credential',
  });
  return <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
    <RuntimePanel t={t} kind="delivery" onRotate={rotate}/>
    <RuntimePanel t={t} kind="server_bot" onRotate={rotate}/>
  </div>;
};

const RuntimePanel = ({ t, kind, onRotate }) => {
  const rt = kind==='delivery' ? t.delivery : t.serverBot;
  const isDel = kind==='delivery';
  const tone = isDel ? 'delivery' : 'serverbot';
  const color = isDel ? 'var(--delivery)' : 'var(--serverbot)';
  const title = isDel ? 'Delivery Agent' : 'Server Bot';
  const capabilities = isDel ? ['Delivery jobs','In-game announce'] : ['Log sync','Config apply','Backup','Restart control'];
  const restrictions = isDel ? ['Cannot edit config','Cannot restart server','Cannot create backup'] : ['Cannot deliver items','Cannot announce in-game'];

  return <div style={{background:'var(--bg-surface)',border:`1px solid ${color}33`,borderRadius:10,overflow:'hidden'}}>
    <div style={{padding:'12px 16px',borderBottom:`1px solid ${color}22`,background:`linear-gradient(180deg, ${isDel?'rgba(56,189,248,0.06)':'rgba(167,139,250,0.06)'}, transparent)`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:32,height:32,borderRadius:8,background:isDel?'var(--delivery-bg)':'var(--serverbot-bg)',display:'flex',alignItems:'center',justifyContent:'center',color:color}}>
          <Icon name={isDel?'truck':'server'} size={16}/>
        </div>
        <div>
          <div style={{fontSize:13,fontWeight:600}}>{title}</div>
          <div style={{fontSize:10.5,color:color,textTransform:'uppercase',letterSpacing:0.8,fontWeight:600}}>{isDel?'execute_only':'sync_only'}</div>
        </div>
      </div>
      <StatusBadge status={rt.status}/>
    </div>
    <div style={{padding:16}}>
      {rt.status==='pending' ? <div style={{textAlign:'center',padding:'16px 0'}}>
        <div style={{fontSize:12,color:'var(--text-3)',marginBottom:12}}>No runtime activated yet</div>
        <Btn size="sm" icon="plus" variant="primary">Generate setup token</Btn>
      </div> : <div>
        <div style={{display:'grid',gridTemplateColumns:'80px 1fr',gap:'8px 12px',fontSize:12,marginBottom:14}}>
          <div style={{color:'var(--text-3)'}}>Runtime ID</div><div className="mono" style={{color:'var(--text-2)'}}>rt_{kind.replace('_','')}_{t.id.slice(2)}</div>
          <div style={{color:'var(--text-3)'}}>Machine</div><div className="mono" style={{color:'var(--text-2)'}}>{rt.machine || '—'}</div>
          <div style={{color:'var(--text-3)'}}>Version</div><div className="mono" style={{color:'var(--text-2)'}}>{rt.version} {rt.version!=='1.8.2' && rt.version!=='—' && <Badge tone="warn" style={{marginLeft:6}}>outdated</Badge>}</div>
          <div style={{color:'var(--text-3)'}}>Last heartbeat</div><div style={{color:rt.status==='offline'?'#fca5a5':'var(--text-2)'}}>{rt.lastSeen?window.fmtTime(rt.lastSeen):'—'} {rt.lastSeen && <span style={{color:'var(--text-muted)',fontSize:10}}>({window.fmtAbs(rt.lastSeen)})</span>}</div>
          <div style={{color:'var(--text-3)'}}>Credential</div><div style={{color:'var(--text-2)'}}><Badge tone="ok" icon="lock">active</Badge></div>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10.5,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6,fontWeight:600}}>Capabilities</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{capabilities.map(c => <Badge key={c} tone={tone} icon="check">{c}</Badge>)}</div>
        </div>
        <div style={{marginBottom:14,opacity:0.6}}>
          <div style={{fontSize:10.5,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6,fontWeight:600}}>Cannot do</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{restrictions.map(c => <Badge key={c} tone="muted" icon="lock">{c}</Badge>)}</div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <Btn size="xs" variant="secondary">View logs</Btn>
          <Btn size="xs" variant="secondary">Heartbeat history</Btn>
          <Btn size="xs" danger onClick={onRotate}>Rotate credential</Btn>
          <Btn size="xs" danger>Revoke</Btn>
        </div>
      </div>}
    </div>
  </div>;
};

const SubscriptionTab = ({ t }) => <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>
  <Card title="Current subscription">
    <div style={{display:'grid',gridTemplateColumns:'140px 1fr',gap:'10px 16px',fontSize:12.5}}>
      <div style={{color:'var(--text-3)'}}>Plan</div><div><Badge tone="ok" icon="pkg">{t.pkg}</Badge></div>
      <div style={{color:'var(--text-3)'}}>Status</div><div><StatusBadge status={t.sub.status==='active'?'active':t.sub.status==='past_due'?'past_due':t.sub.status==='trial'?'trial':'cancelled'}/></div>
      <div style={{color:'var(--text-3)'}}>Interval</div><div>{t.sub.interval}</div>
      <div style={{color:'var(--text-3)'}}>Revenue</div><div className="mono">{t.sub.mrr?`฿${t.sub.mrr.toLocaleString()}/mo`:'—'}</div>
      <div style={{color:'var(--text-3)'}}>Renews</div><div>{t.sub.renewsAt || '—'}</div>
      <div style={{color:'var(--text-3)'}}>Trial ends</div><div>{t.sub.trialEnd || '—'}</div>
    </div>
    <div style={{marginTop:16,display:'flex',gap:8,flexWrap:'wrap'}}>
      <Btn size="sm" variant="primary" icon="pkg">Change package</Btn>
      <Btn size="sm" variant="secondary">Extend trial</Btn>
      <Btn size="sm" danger>Cancel subscription</Btn>
    </div>
  </Card>
  <Card title="Entitlements">
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      {[['Config Editor','enabled'],['Restart Control','enabled'],['Backups','auto + manual'],['Donations','enabled'],['Events','10 active'],['Raid System','enabled'],['Analytics','180 days']].map(([k,v]) => <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0'}}>
        <span style={{color:'var(--text-2)'}}>{k}</span>
        <span style={{color:'var(--text-3)'}}>{v}</span>
      </div>)}
    </div>
  </Card>
</div>;

const BillingTab = ({ t, onConfirm }) => {
  const markPaid = () => onConfirm({
    title:'Mark invoice as paid?', risk:'high',
    body:<div style={{fontSize:12.5,color:'var(--text-2)',lineHeight:1.5}}>Use this only for manual payment reconciliation. An audit event will be created.</div>,
    confirmLabel:'Mark paid',
  });
  return <Card title={`Invoices (${t.billing.failedCount>0?t.billing.failedCount+' failed':'all paid'})`} pad={false}>
    <Table
      columns={[
        { header:'Invoice', render: r => <span className="mono" style={{color:'var(--text)'}}>{r.id}</span>},
        { header:'Amount', align:'right', render: r => <span className="mono">฿{r.amount.toLocaleString()}</span>},
        { header:'Status', render: r => <StatusBadge status={r.status}/>},
        { header:'Due', render: r => r.due},
        { header:'Last attempt', render: r => r.attempt },
        { header:'', render: r => <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>{r.status==='unpaid' && <><Btn size="xs" variant="primary" icon="refresh">Retry</Btn><Btn size="xs" onClick={markPaid}>Mark paid</Btn></>}</div>},
      ]}
      rows={t.billing.status==='unpaid' ? [
        {id:'inv_07', amount:t.sub.mrr, status:'unpaid', due:'Apr 25', attempt:'card_declined · 2h ago'},
        {id:'inv_06', amount:t.sub.mrr, status:'paid', due:'Mar 25', attempt:'—'},
        {id:'inv_05', amount:t.sub.mrr, status:'paid', due:'Feb 25', attempt:'—'},
      ] : [
        {id:'inv_01', amount:t.sub.mrr, status:'paid', due:'Apr 22', attempt:'—'},
        {id:'inv_00', amount:t.sub.mrr, status:'paid', due:'Mar 22', attempt:'—'},
      ]}
    />
  </Card>;
};

const ConfigTab = ({ t, failedJobs }) => <Card title="Config jobs" pad={false}>
  <Table
    columns={[
      { header:'Job', render: j => <span className="mono" style={{color:'var(--text)'}}>{j.id}</span>},
      { header:'Category', render: j => <Badge tone="muted">server-settings</Badge>},
      { header:'Type', render: j => <span className="mono">{j.type.split('.')[1]}</span>},
      { header:'Status', render: j => <StatusBadge status={j.status}/>},
      { header:'Requires restart', render: () => <Badge tone="warn">yes</Badge>},
      { header:'Applied by', render: () => <span style={{color:'var(--text-3)',fontSize:11}}>Server Bot offline</span>},
      { header:'', render: j => <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}><Btn size="xs">View diff</Btn>{j.retryable && <Btn size="xs" variant="primary">Retry</Btn>}</div>},
    ]}
    rows={failedJobs.filter(j=>j.type.startsWith('config'))}
    emptyText="No config jobs in the last 7 days."
  />
</Card>;

const RestartTab = ({ t, onConfirm }) => {
  const blocked = t.serverBot.status !== 'online';
  const scheduleRestart = () => onConfirm({
    title:`Schedule safe restart for ${t.name}?`, risk:'high',
    body:<>
      <div style={{fontSize:12.5,color:'var(--text-2)',lineHeight:1.5,marginBottom:12}}>This will trigger countdown announcements through the Delivery Agent, then execute the restart via Server Bot, then verify health.</div>
      <div style={{background:'var(--bg-surface-2)',border:'1px solid var(--border)',borderRadius:6,padding:12}}>
        <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.5,fontWeight:600,marginBottom:8}}>Readiness check</div>
        <div style={{display:'flex',flexDirection:'column',gap:6,fontSize:12}}>
          <div style={{display:'flex',justifyContent:'space-between'}}>Delivery Agent ready <Badge tone={t.delivery.status==='online'?'ok':'warn'} icon={t.delivery.status==='online'?'check':'alert'}>{t.delivery.status==='online'?'yes':'announce may fail'}</Badge></div>
          <div style={{display:'flex',justifyContent:'space-between'}}>Server Bot ready <Badge tone={t.serverBot.status==='online'?'ok':'danger'} icon={t.serverBot.status==='online'?'check':'x'}>{t.serverBot.status==='online'?'yes':'BLOCKED'}</Badge></div>
          <div style={{display:'flex',justifyContent:'space-between'}}>Active queue <Badge tone="muted">none</Badge></div>
        </div>
      </div>
    </>,
    confirmLabel:'Schedule restart',
    disabled: blocked,
  });
  return <div>
    {blocked && <div style={{background:'var(--danger-bg)',border:'1px solid var(--danger-border)',borderRadius:6,padding:'10px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:10,fontSize:12.5}}>
      <Icon name="alert" size={14} style={{color:'#fca5a5'}}/>
      <span><b>Restart is blocked</b> — Server Bot must be online to execute restart commands.</span>
    </div>}
    <Card title="Restart plans" pad={false} actions={<Btn size="xs" variant="primary" icon="plus" onClick={scheduleRestart} disabled={blocked}>Schedule restart</Btn>}>
      <Table
        columns={[
          { header:'Plan', render: r => <span className="mono">{r.id}</span>},
          { header:'Type', render: r => <Badge tone="info">{r.type}</Badge>},
          { header:'Scheduled', render: r => r.at},
          { header:'Delivery', render: r => <Badge tone={t.delivery.status==='online'?'ok':'warn'}>{t.delivery.status==='online'?'ready':'offline'}</Badge>},
          { header:'Server Bot', render: r => <Badge tone={t.serverBot.status==='online'?'ok':'danger'}>{t.serverBot.status==='online'?'ready':'offline'}</Badge>},
          { header:'Status', render: r => <StatusBadge status={r.status}/>},
        ]}
        rows={[
          {id:'restart_01', type:'safe_restart', at:'11:00 today', status:blocked?'blocked':'pending'},
        ]}
      />
    </Card>
  </div>;
};

const BackupsTab = ({ t }) => <Card title="Backups" pad={false} actions={<Btn size="xs" icon="plus" variant="primary">Create backup</Btn>}>
  <Table
    columns={[
      { header:'Backup', render: b => <span className="mono">{b.id}</span>},
      { header:'Type', render: b => <Badge tone="muted">{b.type}</Badge>},
      { header:'Source', render: b => <Badge tone="serverbot" icon="server">Server Bot</Badge>},
      { header:'Size', align:'right', render: b => <span className="mono">{b.size}</span>},
      { header:'Created', render: b => b.at},
      { header:'Verified', render: () => <Badge tone="ok" icon="check">verified</Badge>},
      { header:'', render: b => <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}><Btn size="xs">Compare</Btn><Btn size="xs" variant="primary">Restore</Btn></div>},
    ]}
    rows={[
      {id:'backup_01', type:'config', size:'124 KB', at:'Yesterday 23:00'},
      {id:'backup_00', type:'config', size:'119 KB', at:'2 days ago 23:00'},
      {id:'bk_manual_02', type:'manual', size:'2.4 MB', at:'4 days ago'},
    ]}
  />
</Card>;

const SupportTab = ({ t }) => <Card title={`Support cases (${t.openCases} open)`} pad={false}>
  {t.openCases===0 ? <div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>
    <div style={{fontSize:13,marginBottom:10}}>No open support cases</div>
    <Btn size="sm" icon="plus" variant="secondary">Create case</Btn>
  </div> : <div>
    <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border-subtle)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
        <Badge tone="danger">HIGH</Badge>
        <span style={{fontWeight:600}}>Server Bot offline — restart blocked</span>
        <span style={{color:'var(--text-3)',fontSize:11,marginLeft:'auto'}}>case_01 · opened {window.fmtTime(t.serverBot.lastSeen || window.NOW)}</span>
      </div>
      <div style={{fontSize:12,color:'var(--text-3)',marginBottom:10}}>Customer reports server is down. Server Bot heartbeat stale for 109 minutes. Linked diagnostics attached.</div>
      <div style={{display:'flex',gap:6}}>
        <Btn size="xs">Add note</Btn>
        <Btn size="xs">Attach diagnostics</Btn>
        <Btn size="xs" variant="secondary">Escalate</Btn>
      </div>
    </div>
  </div>}
</Card>;

const AuditTab = ({ audit }) => <Card title="Audit log" pad={false}>
  <Table
    columns={[
      { header:'Time', render: a => <span style={{color:'var(--text-3)'}}>{window.fmtTime(a.at)}</span>},
      { header:'Actor', render: a => a.actor},
      { header:'Action', render: a => <span className="mono">{a.action}</span>},
      { header:'Target', render: a => <span className="mono" style={{color:'var(--text-3)'}}>{a.target}</span>},
      { header:'Risk', render: a => <RiskBadge level={a.risk}/>},
      { header:'Result', render: a => <StatusBadge status={a.result==='success'?'online':a.result==='failed'?'failed':a.result==='blocked'?'blocked':'degraded'}/>},
    ]}
    rows={audit}
  />
</Card>;

const DiagnosticsTab = ({ t }) => {
  const checks = [
    { k:'Tenant exists', s:'pass' },
    { k:'Subscription active', s: t.sub.status==='active'?'pass':t.sub.status==='past_due'?'fail':'pass' },
    { k:'Package valid', s:'pass' },
    { k:'Delivery Agent online', s: t.delivery.status==='online'?'pass':'fail', msg: t.delivery.status!=='online'?'Last heartbeat '+window.fmtTime(t.delivery.lastSeen)+' ago':null },
    { k:'Server Bot online', s: t.serverBot.status==='online'?'pass':'fail', msg: t.serverBot.status!=='online'?'Last heartbeat was 109 minutes ago':null, rec: t.serverBot.status!=='online'?'Open runtime detail':null },
    { k:'Last heartbeat fresh', s: t.serverBot.status==='online'?'pass':'fail' },
    { k:'Config jobs healthy', s: window.JOBS.filter(j=>j.tenantId===t.id&&j.type.startsWith('config')&&j.status==='failed').length>0?'fail':'pass' },
    { k:'Restart jobs healthy', s: t.serverBot.status==='online'?'pass':'warn' },
    { k:'Backup available', s:'pass' },
    { k:'Billing healthy', s: t.billing.status==='paid'?'pass':t.billing.status==='unpaid'?'fail':'pass' },
    { k:'Queue healthy', s:'pass' },
    { k:'Recent security events', s:'pass' },
  ];
  const failing = checks.filter(c=>c.s==='fail').length;
  return <div>
    <div style={{display:'flex',alignItems:'center',gap:14,background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 16px',marginBottom:14}}>
      <div style={{width:44,height:44,borderRadius:10,background:failing?'var(--danger-bg)':'var(--ok-bg)',display:'flex',alignItems:'center',justifyContent:'center',color:failing?'#fca5a5':'#86efac'}}>
        <Icon name={failing?'alert':'check'} size={20}/>
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:14,fontWeight:600}}>{failing?`${failing} check${failing>1?'s':''} failing`:'All checks passing'}</div>
        <div style={{fontSize:12,color:'var(--text-3)'}}>Last run {window.fmtTime(window.NOW)} · {checks.length} checks</div>
      </div>
      <Btn size="sm" icon="refresh" variant="primary">Run again</Btn>
      <Btn size="sm" variant="secondary">Attach to case</Btn>
    </div>
    <Card pad={false}>
      {checks.map((c,i) => <div key={i} style={{padding:'10px 16px',borderBottom:i<checks.length-1?'1px solid var(--border-subtle)':0,display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:20,height:20,borderRadius:'50%',background:c.s==='pass'?'var(--ok-bg)':c.s==='fail'?'var(--danger-bg)':'var(--warn-bg)',display:'flex',alignItems:'center',justifyContent:'center',color:c.s==='pass'?'#86efac':c.s==='fail'?'#fca5a5':'#fbbf24'}}>
          <Icon name={c.s==='pass'?'check':c.s==='fail'?'x':'alert'} size={11}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:12.5}}>{c.k}</div>
          {c.msg && <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{c.msg}</div>}
        </div>
        {c.rec && <Btn size="xs">{c.rec}</Btn>}
        <Badge tone={c.s==='pass'?'ok':c.s==='fail'?'danger':'warn'}>{c.s.toUpperCase()}</Badge>
      </div>)}
    </Card>
  </div>;
};

window.TenantDetail = TenantDetail;
