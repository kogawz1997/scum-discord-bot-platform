// Owner Overview
const Overview = ({ onNav }) => {
  const D = window.DASHBOARD;
  const atRisk = window.TENANTS.filter(t => t.risk.level==='high' || t.risk.level==='critical').slice(0,6);
  const failedJobs = window.JOBS.filter(j => j.status==='failed' || j.status==='dead_letter' || j.status==='blocked');
  const tenantName = (id) => window.TENANTS.find(t=>t.id===id)?.name || id;

  return <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:20}}>
    {/* Risk Banner */}
    <div style={{background:'linear-gradient(180deg, rgba(245,158,11,0.08), transparent)',border:'1px solid var(--warn-border)',borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',gap:16}}>
      <div style={{width:40,height:40,borderRadius:10,background:'var(--warn-bg)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fbbf24'}}><Icon name="alert" size={20}/></div>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>Platform is <span style={{color:'#fbbf24'}}>Degraded</span> — 3 issues need attention</div>
        <div style={{fontSize:12,color:'var(--text-3)'}}>{D.platform.riskReasons.join(' · ')}</div>
      </div>
      <Btn size="sm" variant="secondary" onClick={()=>onNav('runtime')}>Open Runtime Health</Btn>
      <Btn size="sm" variant="primary" icon="chevronRight" onClick={()=>onNav('tenants',{riskFilter:'high'})}>View at-risk tenants</Btn>
    </div>

    {/* Tenant health row */}
    <div>
      <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.8,fontWeight:600,marginBottom:10}}>Tenant Health</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(6, 1fr)',gap:12}}>
        <MetricCard label="Total tenants" value={D.tenants.total} onClick={()=>onNav('tenants')}/>
        <MetricCard label="Active" value={D.tenants.active} tone="ok"/>
        <MetricCard label="Preview" value={D.tenants.preview} tone="info" sub="visible locked features"/>
        <MetricCard label="Trial" value={D.tenants.trial} tone="info" sub="1 ending in 3 days"/>
        <MetricCard label="Suspended" value={D.tenants.suspended} tone="default"/>
        <MetricCard label="At risk" value={D.tenants.atRisk} tone="danger" onClick={()=>onNav('tenants',{riskFilter:'high'})}/>
      </div>
    </div>

    {/* Revenue + Runtime row */}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div>
        <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.8,fontWeight:600,marginBottom:10}}>Revenue Health</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:10}}>
          <MetricCard label="MRR (THB)" value={`฿${D.revenue.mrr.toLocaleString()}`} sub={`${D.revenue.activeSubscriptions} active subs`}/>
          <MetricCard label="Unpaid invoices" value={D.revenue.unpaidInvoices} tone="warn" onClick={()=>onNav('billing')}/>
          <MetricCard label="Failed payments" value={D.revenue.failedPayments} tone="danger"/>
        </div>
      </div>
      <div>
        <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.8,fontWeight:600,marginBottom:10}}>Runtime Health</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:10}}>
          <MetricCard label="Delivery online" value={`${D.runtime.deliveryOnline}/${D.runtime.deliveryOnline+D.runtime.deliveryOffline}`} tone={D.runtime.deliveryOffline>0?'warn':'ok'} sub="execute_only"/>
          <MetricCard label="Server Bots online" value={`${D.runtime.botOnline}/${D.runtime.botOnline+D.runtime.botOffline}`} tone="danger" sub="sync_only" onClick={()=>onNav('runtime')}/>
          <MetricCard label="Outdated runtimes" value={D.runtime.outdated} tone="warn" sub="version < 1.8.2"/>
        </div>
      </div>
    </div>

    {/* At risk table + ops risk */}
    <div style={{display:'grid',gridTemplateColumns:'1.6fr 1fr',gap:16}}>
      <Card title="At-risk tenants" actions={<Btn size="xs" onClick={()=>onNav('tenants',{riskFilter:'high'})}>View all →</Btn>} pad={false}>
        <Table
          columns={[
            { header:'Tenant', key:'name', render: t => <div style={{display:'flex',alignItems:'center',gap:8}}><StatusDot status={t.status==='active'?'online':'offline'}/><div><div style={{fontWeight:500,color:'var(--text)'}}>{t.name}</div><div className="mono" style={{fontSize:10,color:'var(--text-muted)'}}>{t.slug}</div></div></div> },
            { header:'Package', render: t => <Badge tone={t.pkg==='Enterprise'?'info':t.pkg==='Pro'?'ok':'muted'}>{t.pkg}</Badge> },
            { header:'Risk', render: t => <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>{t.risk.badges.slice(0,2).map((b,i)=><Badge key={i} tone={b.includes('Offline')||b.includes('Failed')?'danger':'warn'}>{b}</Badge>)}{t.risk.badges.length>2 && <Badge tone="muted">+{t.risk.badges.length-2}</Badge>}</div> },
            { header:'Level', align:'right', render: t => <RiskBadge level={t.risk.level}/> },
          ]}
          rows={atRisk}
          onRowClick={(t)=>onNav('tenant-detail',{tenantId:t.id})}
          dense
        />
      </Card>

      <Card title="Operations Risk Queue" pad={false}>
        <div style={{padding:'8px 0'}}>
          {failedJobs.map(j => <div key={j.id} style={{padding:'10px 14px',borderBottom:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',gap:10}}>
            <StatusBadge status={j.status}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,display:'flex',alignItems:'center',gap:8}}>
                <span className="mono" style={{color:'var(--text-3)'}}>{j.type}</span>
                <span style={{color:'var(--text-2)'}}>· {tenantName(j.tenantId)}</span>
              </div>
              <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{j.err} · {window.fmtTime(j.createdAt)}</div>
            </div>
            {j.retryable && <Btn size="xs" icon="refresh">Retry</Btn>}
          </div>)}
        </div>
      </Card>
    </div>

    {/* Security + Support */}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
      <Card title="Security snapshot" pad={false}>
        <div>
          {window.SECURITY.map(s => <div key={s.id} style={{padding:'10px 14px',borderBottom:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',gap:10}}>
            <StatusDot status={s.severity==='high'?'offline':s.severity==='medium'?'degraded':'online'}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:500}}>{s.type}</div>
              <div style={{fontSize:11,color:'var(--text-3)'}}>{s.tenantId?tenantName(s.tenantId):'platform'} · {s.ip} · {window.fmtTime(s.at)}</div>
            </div>
            <RiskBadge level={s.severity}/>
          </div>)}
        </div>
      </Card>

      <Card title="Support snapshot" pad={false}>
        <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,color:'var(--text-2)'}}>Open cases</span>
            <span style={{fontSize:18,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{D.support.openCases}</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,color:'var(--text-2)'}}>High priority</span>
            <Badge tone="danger">{D.support.highPriority}</Badge>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,color:'var(--text-2)'}}>Waiting owner action</span>
            <Badge tone="warn">{D.support.waitingOwner}</Badge>
          </div>
          <div style={{borderTop:'1px solid var(--border)',paddingTop:10,marginTop:4}}>
            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>Active incidents</div>
            {window.INCIDENTS.map(i => <div key={i.id} style={{padding:'6px 0',fontSize:12,display:'flex',alignItems:'center',gap:8}}>
              <Badge tone={i.severity==='high'?'danger':'warn'}>{i.severity}</Badge>
              <span style={{flex:1,color:'var(--text-2)',minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{i.title}</span>
              <span style={{fontSize:11,color:'var(--text-3)'}}>{window.fmtTime(i.startedAt)}</span>
            </div>)}
          </div>
        </div>
      </Card>

      <Card title="Quick actions" pad={false}>
        <div style={{padding:'10px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <Btn size="sm" variant="secondary" icon="plus" style={{justifyContent:'flex-start'}}>Create tenant</Btn>
          <Btn size="sm" variant="secondary" icon="truck" style={{justifyContent:'flex-start'}}>Provision Delivery</Btn>
          <Btn size="sm" variant="secondary" icon="server" style={{justifyContent:'flex-start'}}>Provision Server Bot</Btn>
          <Btn size="sm" variant="secondary" icon="pkg" style={{justifyContent:'flex-start'}}>Create package</Btn>
          <Btn size="sm" variant="secondary" icon="lifebuoy" style={{justifyContent:'flex-start'}}>New support case</Btn>
          <Btn size="sm" variant="secondary" icon="list" style={{justifyContent:'flex-start'}}>Run diagnostics</Btn>
        </div>
      </Card>
    </div>

    <div style={{fontSize:11,color:'var(--text-muted)',textAlign:'right',paddingTop:4}}>Last updated {window.fmtAbs(D.generatedAt)} · auto-refresh via SSE</div>
  </div>;
};
window.Overview = Overview;
