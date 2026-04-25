// Agents & Bots — provision + catalog
const Agents = ({ onNav }) => {
  const [showWizard, setShowWizard] = useState(false);
  const [wz, setWz] = useState({ step:1, tenantId:'', kind:'', scope:'' });

  const counts = {
    delivery: window.FLEET.filter(r=>r.kind==='delivery').length,
    serverBot: window.FLEET.filter(r=>r.kind==='server_bot').length,
  };

  return <div>
    <PageHeader
      title="Agents & Bots"
      subtitle="Provision, rotate, and revoke runtime credentials. Enforces the single-responsibility split: Delivery Agents execute, Server Bots sync."
      actions={<Btn size="sm" icon="plus" variant="primary" onClick={()=>{setShowWizard(true);setWz({step:1,tenantId:'',kind:'',scope:''});}}>Provision runtime</Btn>}
    />
    <div style={{padding:24,display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div style={{background:'var(--bg-surface)',border:'1px solid var(--delivery-border)',borderRadius:10,padding:18}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <div style={{width:40,height:40,borderRadius:10,background:'var(--delivery-bg)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--delivery)'}}>
            <Icon name="truck" size={18}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:600}}>Delivery Agent</div>
            <div style={{fontSize:11,color:'var(--delivery)',textTransform:'uppercase',letterSpacing:0.8,fontWeight:600}}>execute_only · {counts.delivery} active</div>
          </div>
        </div>
        <div style={{fontSize:12.5,color:'var(--text-2)',lineHeight:1.55,marginBottom:14}}>Runs on the shop PC. Executes in-game delivery jobs and announcements. <b>Cannot</b> edit config, restart servers, or access backups.</div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10.5,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.5,fontWeight:600,marginBottom:6}}>Capabilities</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            <Badge tone="delivery" icon="check">delivery_jobs</Badge>
            <Badge tone="delivery" icon="check">in_game_announce</Badge>
          </div>
        </div>
        <div style={{opacity:0.65}}>
          <div style={{fontSize:10.5,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.5,fontWeight:600,marginBottom:6}}>Cannot</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            <Badge tone="muted" icon="lock">config_apply</Badge>
            <Badge tone="muted" icon="lock">restart</Badge>
            <Badge tone="muted" icon="lock">backup</Badge>
          </div>
        </div>
      </div>

      <div style={{background:'var(--bg-surface)',border:'1px solid var(--serverbot-border)',borderRadius:10,padding:18}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <div style={{width:40,height:40,borderRadius:10,background:'var(--serverbot-bg)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--serverbot)'}}>
            <Icon name="server" size={18}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:600}}>Server Bot</div>
            <div style={{fontSize:11,color:'var(--serverbot)',textTransform:'uppercase',letterSpacing:0.8,fontWeight:600}}>sync_only · {counts.serverBot} active</div>
          </div>
        </div>
        <div style={{fontSize:12.5,color:'var(--text-2)',lineHeight:1.55,marginBottom:14}}>Runs on the server host. Syncs logs, applies config, performs backups, and orchestrates restarts. <b>Cannot</b> deliver items or announce in-game.</div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10.5,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.5,fontWeight:600,marginBottom:6}}>Capabilities</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            <Badge tone="serverbot" icon="check">log_sync</Badge>
            <Badge tone="serverbot" icon="check">config_apply</Badge>
            <Badge tone="serverbot" icon="check">backup</Badge>
            <Badge tone="serverbot" icon="check">restart</Badge>
          </div>
        </div>
        <div style={{opacity:0.65}}>
          <div style={{fontSize:10.5,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.5,fontWeight:600,marginBottom:6}}>Cannot</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            <Badge tone="muted" icon="lock">delivery_jobs</Badge>
            <Badge tone="muted" icon="lock">in_game_announce</Badge>
          </div>
        </div>
      </div>
    </div>

    <div style={{padding:'0 24px 24px'}}>
      <Card title="Runtime catalog" pad={false}>
        <Table
          onRowClick={r=>onNav('tenant-detail',{tenantId:r.tenantId})}
          columns={[
            { header:'Runtime', render: r => <div style={{display:'flex',alignItems:'center',gap:8}}><RuntimeTag kind={r.kind}/><span className="mono" style={{fontSize:11,color:'var(--text-3)'}}>{r.id}</span></div>},
            { header:'Tenant', render: r => r.tenantName},
            { header:'Machine', render: r => <span className="mono">{r.machine || '—'}</span>},
            { header:'Status', render: r => <StatusBadge status={r.status}/>},
            { header:'Version', render: r => <span className="mono">{r.version}</span>},
            { header:'Credential', render: () => <Badge tone="ok" icon="lock">active</Badge>},
            { header:'', render: () => <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}><Btn size="xs">Rotate</Btn><Btn size="xs" danger>Revoke</Btn></div>},
          ]}
          rows={window.FLEET}
        />
      </Card>
    </div>

    <ProvisionWizard open={showWizard} onClose={()=>setShowWizard(false)} wz={wz} setWz={setWz}/>
  </div>;
};

const ProvisionWizard = ({ open, onClose, wz, setWz }) => {
  const canNext = (wz.step===1 && wz.tenantId) || (wz.step===2 && wz.kind) || (wz.step===3);
  const tenant = window.TENANTS.find(t=>t.id===wz.tenantId);

  return <Modal open={open} onClose={onClose} title={`Provision runtime — step ${wz.step} of 4`} maxWidth={620} footer={
    <>
      {wz.step>1 && <Btn size="sm" onClick={()=>setWz({...wz,step:wz.step-1})}>Back</Btn>}
      <div style={{flex:1}}/>
      <Btn size="sm" onClick={onClose}>Cancel</Btn>
      {wz.step<4 ? <Btn size="sm" variant="primary" disabled={!canNext} onClick={()=>setWz({...wz,step:wz.step+1})}>Continue</Btn> : <Btn size="sm" variant="primary" onClick={onClose}>Done</Btn>}
    </>
  }>
    {wz.step===1 && <div>
      <div style={{fontSize:12.5,color:'var(--text-2)',marginBottom:12}}>Choose the tenant this runtime will belong to.</div>
      <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:280,overflow:'auto'}}>
        {window.TENANTS.map(t => <label key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',border:`1px solid ${wz.tenantId===t.id?'var(--accent)':'var(--border)'}`,borderRadius:6,cursor:'pointer',background:wz.tenantId===t.id?'var(--bg-surface-3)':'transparent'}}>
          <input type="radio" checked={wz.tenantId===t.id} onChange={()=>setWz({...wz,tenantId:t.id})} style={{accentColor:'var(--accent)'}}/>
          <StatusDot status={t.status==='active'?'online':'offline'}/>
          <div style={{flex:1}}>
            <div style={{fontSize:12.5,fontWeight:500}}>{t.name}</div>
            <div className="mono" style={{fontSize:10.5,color:'var(--text-3)'}}>{t.slug}</div>
          </div>
          <Badge tone="muted">{t.pkg}</Badge>
        </label>)}
      </div>
    </div>}
    {wz.step===2 && <div>
      <div style={{fontSize:12.5,color:'var(--text-2)',marginBottom:12}}>Pick runtime type for <b style={{color:'var(--text)'}}>{tenant?.name}</b>. Each tenant can have exactly one of each.</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {[
          {k:'delivery',title:'Delivery Agent',desc:'Executes delivery jobs and announcements from shop PC',icon:'truck',tone:'delivery'},
          {k:'server_bot',title:'Server Bot',desc:'Syncs logs, applies config, backups, restart control',icon:'server',tone:'serverbot'},
        ].map(o => <button key={o.k} onClick={()=>setWz({...wz,kind:o.k,scope:o.k==='delivery'?'execute_only':'sync_only'})} style={{padding:14,background:wz.kind===o.k?`var(--${o.tone}-bg)`:'var(--bg-surface-2)',border:`1px solid ${wz.kind===o.k?`var(--${o.tone})`:'var(--border)'}`,borderRadius:8,textAlign:'left',cursor:'pointer',color:'var(--text)',fontFamily:'inherit'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><Icon name={o.icon} size={16} style={{color:`var(--${o.tone})`}}/><div style={{fontSize:13,fontWeight:600}}>{o.title}</div></div>
          <div style={{fontSize:11.5,color:'var(--text-3)',lineHeight:1.5}}>{o.desc}</div>
        </button>)}
      </div>
    </div>}
    {wz.step===3 && <div>
      <div style={{fontSize:12.5,color:'var(--text-2)',marginBottom:12}}>Review scope — capabilities are fixed by role and cannot be expanded.</div>
      <div style={{background:'var(--bg-surface-2)',border:'1px solid var(--border)',borderRadius:6,padding:14,fontSize:12.5}}>
        <div style={{display:'grid',gridTemplateColumns:'110px 1fr',gap:'8px 12px'}}>
          <span style={{color:'var(--text-3)'}}>Tenant</span><span>{tenant?.name}</span>
          <span style={{color:'var(--text-3)'}}>Role</span><span><Badge tone={wz.kind==='delivery'?'delivery':'serverbot'}>{wz.kind}</Badge></span>
          <span style={{color:'var(--text-3)'}}>Scope</span><span><Badge tone="muted">{wz.scope}</Badge></span>
          <span style={{color:'var(--text-3)'}}>Version</span><span className="mono">1.8.2 (latest)</span>
          <span style={{color:'var(--text-3)'}}>Token TTL</span><span>24 hours</span>
        </div>
      </div>
    </div>}
    {wz.step===4 && <div>
      <div style={{background:'var(--ok-bg)',border:'1px solid var(--ok-border)',borderRadius:6,padding:'10px 14px',marginBottom:12,fontSize:12.5,display:'flex',alignItems:'center',gap:8}}>
        <Icon name="check" size={14} style={{color:'#86efac'}}/>
        Setup token generated. Share it with the operator — it's single-use and expires in 24h.
      </div>
      <div style={{fontSize:10.5,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:0.5,fontWeight:600,marginBottom:6}}>Setup token</div>
      <div style={{background:'var(--bg-app)',border:'1px solid var(--border)',borderRadius:6,padding:12,fontFamily:'JetBrains Mono',fontSize:12,wordBreak:'break-all',color:'var(--accent)'}}>stkn_{wz.kind}_{tenant?.slug}_4f8a9b2c1d7e6f5a3b8c9d0e1f2a3b4c</div>
      <div style={{display:'flex',gap:6,marginTop:10}}>
        <Btn size="sm" icon="copy">Copy token</Btn>
        <Btn size="sm">Download setup guide</Btn>
      </div>
    </div>}
  </Modal>;
};
window.Agents = Agents;
