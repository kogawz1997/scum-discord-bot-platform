// Mock platform data for Owner Panel

const NOW = new Date('2026-04-23T10:30:00+07:00');
const relTime = (minutesAgo) => new Date(NOW.getTime() - minutesAgo * 60000);

const fmtTime = (date) => {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  const diff = (NOW - d) / 60000;
  if (diff < 1) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}m ago`;
  if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
  return `${Math.floor(diff/1440)}d ago`;
};
const fmtAbs = (date) => {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:false });
};

const TENANTS = [
  {
    id:'t_bkk', slug:'bangkok-survival', name:'Bangkok Survival',
    status:'active', locale:'th', tz:'Asia/Bangkok',
    ownerEmail:'admin@bkk-survival.gg', ownerName:'Kittisak P.',
    pkg:'Pro', pkgId:'pkg_pro',
    sub:{ status:'active', renewsAt:'2026-05-22', interval:'monthly', mrr:2490 },
    billing:{ status:'paid', failedCount:0, latestInvoice:'inv_01' },
    delivery:{ status:'online', version:'1.8.2', lastSeen:relTime(2), machine:'SHOP-PC-01' },
    serverBot:{ status:'offline', version:'1.8.0', lastSeen:relTime(109), machine:'SERVER-BOX-01' },
    risk:{ level:'high', badges:['Server Bot Offline','Restart Blocked','Outdated Runtime'] },
    createdAt:'2025-11-04',
    players:842,
    openCases:1,
  },
  {
    id:'t_chm', slug:'chiangmai-frontier', name:'Chiangmai Frontier',
    status:'active', locale:'th', tz:'Asia/Bangkok',
    ownerEmail:'owner@cm-frontier.th', ownerName:'Nattapong S.',
    pkg:'Growth', pkgId:'pkg_growth',
    sub:{ status:'active', renewsAt:'2026-05-02', interval:'monthly', mrr:1290 },
    billing:{ status:'paid', failedCount:0 },
    delivery:{ status:'online', version:'1.8.2', lastSeen:relTime(1), machine:'SHOP-01' },
    serverBot:{ status:'online', version:'1.8.2', lastSeen:relTime(0), machine:'SRV-01' },
    risk:{ level:'low', badges:[] },
    createdAt:'2025-09-12',
    players:421,
    openCases:0,
  },
  {
    id:'t_pnx', slug:'phuket-wasteland', name:'Phuket Wasteland',
    status:'active', locale:'en', tz:'Asia/Bangkok',
    ownerEmail:'ops@phuketwaste.com', ownerName:'Siripong T.',
    pkg:'Pro', pkgId:'pkg_pro',
    sub:{ status:'past_due', renewsAt:'2026-04-18', interval:'monthly', mrr:2490 },
    billing:{ status:'unpaid', failedCount:2, latestInvoice:'inv_07' },
    delivery:{ status:'online', version:'1.8.2', lastSeen:relTime(3), machine:'PKT-SHOP' },
    serverBot:{ status:'online', version:'1.8.2', lastSeen:relTime(1), machine:'PKT-SRV' },
    risk:{ level:'high', badges:['Payment Failed','Due Soon'] },
    createdAt:'2025-08-22',
    players:312,
    openCases:1,
  },
  {
    id:'t_hdy', slug:'hatyai-apocalypse', name:'Hatyai Apocalypse',
    status:'preview', locale:'th', tz:'Asia/Bangkok',
    ownerEmail:'dev@hatyai-apo.gg', ownerName:'Arthit R.',
    pkg:'Preview', pkgId:'pkg_preview',
    sub:{ status:'trial', trialEnd:'2026-04-26', interval:'monthly', mrr:0 },
    billing:{ status:'none', failedCount:0 },
    delivery:{ status:'pending', version:'—', lastSeen:null, machine:null },
    serverBot:{ status:'pending', version:'—', lastSeen:null, machine:null },
    risk:{ level:'medium', badges:['Trial Ending','Runtime Not Activated'] },
    createdAt:'2026-04-19',
    players:0,
    openCases:0,
  },
  {
    id:'t_nak', slug:'nakhon-raiders', name:'Nakhon Raiders',
    status:'active', locale:'en', tz:'Asia/Bangkok',
    ownerEmail:'raid@nkraiders.io', ownerName:'Panupong L.',
    pkg:'Enterprise', pkgId:'pkg_ent',
    sub:{ status:'active', renewsAt:'2026-10-14', interval:'yearly', mrr:4990 },
    billing:{ status:'paid', failedCount:0 },
    delivery:{ status:'online', version:'1.8.2', lastSeen:relTime(0), machine:'ENT-DEL-01' },
    serverBot:{ status:'online', version:'1.8.2', lastSeen:relTime(0), machine:'ENT-SRV-01' },
    risk:{ level:'low', badges:[] },
    createdAt:'2024-10-14',
    players:1284,
    openCases:0,
  },
  {
    id:'t_kkc', slug:'khonkaen-outpost', name:'Khonkaen Outpost',
    status:'active', locale:'th', tz:'Asia/Bangkok',
    ownerEmail:'admin@kk-outpost.gg', ownerName:'Worawit K.',
    pkg:'Growth', pkgId:'pkg_growth',
    sub:{ status:'active', renewsAt:'2026-05-09', interval:'monthly', mrr:1290 },
    billing:{ status:'paid', failedCount:0 },
    delivery:{ status:'offline', version:'1.7.4', lastSeen:relTime(240), machine:'KK-SHOP' },
    serverBot:{ status:'online', version:'1.8.2', lastSeen:relTime(2), machine:'KK-SRV' },
    risk:{ level:'medium', badges:['Delivery Offline','Outdated Runtime'] },
    createdAt:'2025-07-18',
    players:198,
    openCases:0,
  },
  {
    id:'t_ubn', slug:'ubon-badlands', name:'Ubon Badlands',
    status:'suspended', locale:'th', tz:'Asia/Bangkok',
    ownerEmail:'x@ubon-bad.com', ownerName:'Somsak V.',
    pkg:'Starter', pkgId:'pkg_starter',
    sub:{ status:'cancelled', endedAt:'2026-04-10', interval:'monthly', mrr:0 },
    billing:{ status:'none', failedCount:3 },
    delivery:{ status:'offline', version:'1.6.1', lastSeen:relTime(18000), machine:'UB-01' },
    serverBot:{ status:'offline', version:'1.6.1', lastSeen:relTime(18000), machine:'UB-01' },
    risk:{ level:'low', badges:['Suspended'] },
    createdAt:'2025-02-14',
    players:0,
    openCases:0,
  },
  {
    id:'t_pat', slug:'pattaya-dropzone', name:'Pattaya Dropzone',
    status:'active', locale:'en', tz:'Asia/Bangkok',
    ownerEmail:'ops@pattayadrop.gg', ownerName:'Ekachai M.',
    pkg:'Pro', pkgId:'pkg_pro',
    sub:{ status:'active', renewsAt:'2026-05-19', interval:'monthly', mrr:2490 },
    billing:{ status:'paid', failedCount:0 },
    delivery:{ status:'online', version:'1.8.2', lastSeen:relTime(0), machine:'PT-DEL' },
    serverBot:{ status:'degraded', version:'1.8.2', lastSeen:relTime(14), machine:'PT-SRV' },
    risk:{ level:'medium', badges:['Config Job Failed'] },
    createdAt:'2025-06-30',
    players:567,
    openCases:1,
  },
  {
    id:'t_knc', slug:'kanchanaburi-bridge', name:'Kanchanaburi Bridge',
    status:'active', locale:'th', tz:'Asia/Bangkok',
    ownerEmail:'kc@kcburi.gg', ownerName:'Prasert N.',
    pkg:'Starter', pkgId:'pkg_starter',
    sub:{ status:'active', renewsAt:'2026-05-03', interval:'monthly', mrr:590 },
    billing:{ status:'paid', failedCount:0 },
    delivery:{ status:'online', version:'1.8.2', lastSeen:relTime(4), machine:'KN-01' },
    serverBot:{ status:'online', version:'1.8.2', lastSeen:relTime(2), machine:'KN-SRV' },
    risk:{ level:'low', badges:[] },
    createdAt:'2026-02-03',
    players:87,
    openCases:0,
  },
  {
    id:'t_kbi', slug:'krabi-lastlight', name:'Krabi Lastlight',
    status:'active', locale:'en', tz:'Asia/Bangkok',
    ownerEmail:'admin@krabi-ll.io', ownerName:'Supachai O.',
    pkg:'Growth', pkgId:'pkg_growth',
    sub:{ status:'active', renewsAt:'2026-05-11', interval:'monthly', mrr:1290 },
    billing:{ status:'paid', failedCount:0 },
    delivery:{ status:'online', version:'1.8.2', lastSeen:relTime(1), machine:'KB-01' },
    serverBot:{ status:'online', version:'1.8.2', lastSeen:relTime(0), machine:'KB-SRV' },
    risk:{ level:'low', badges:[] },
    createdAt:'2025-10-22',
    players:234,
    openCases:0,
  },
  {
    id:'t_cry', slug:'chiangrai-blacksite', name:'Chiangrai Blacksite',
    status:'active', locale:'en', tz:'Asia/Bangkok',
    ownerEmail:'sec@cr-blacksite.io', ownerName:'Theerapat C.',
    pkg:'Pro', pkgId:'pkg_pro',
    sub:{ status:'active', renewsAt:'2026-05-07', interval:'monthly', mrr:2490 },
    billing:{ status:'paid', failedCount:0 },
    delivery:{ status:'online', version:'1.8.2', lastSeen:relTime(2), machine:'CR-DEL' },
    serverBot:{ status:'online', version:'1.8.2', lastSeen:relTime(1), machine:'CR-SRV' },
    risk:{ level:'low', badges:[] },
    createdAt:'2025-04-03',
    players:612,
    openCases:0,
  },
  {
    id:'t_syp', slug:'surat-highway', name:'Surat Highway',
    status:'active', locale:'th', tz:'Asia/Bangkok',
    ownerEmail:'srt@surathw.gg', ownerName:'Anan J.',
    pkg:'Growth', pkgId:'pkg_growth',
    sub:{ status:'active', renewsAt:'2026-05-27', interval:'monthly', mrr:1290 },
    billing:{ status:'paid', failedCount:0 },
    delivery:{ status:'online', version:'1.8.1', lastSeen:relTime(6), machine:'SR-01' },
    serverBot:{ status:'online', version:'1.8.1', lastSeen:relTime(3), machine:'SR-SRV' },
    risk:{ level:'low', badges:['Outdated Runtime'] },
    createdAt:'2025-12-01',
    players:156,
    openCases:0,
  },
];

const JOBS = [
  { id:'job_1001', tenantId:'t_bkk', type:'config.apply', status:'failed', err:'Server Bot offline before apply', createdAt:relTime(20), attempts:2, max:3, retryable:true },
  { id:'job_1002', tenantId:'t_bkk', type:'restart.schedule', status:'blocked', err:'Server Bot offline', createdAt:relTime(18), attempts:0, max:3, retryable:true },
  { id:'job_1003', tenantId:'t_pat', type:'config.apply', status:'failed', err:'Validation: gameUserSettings.Difficulty missing', createdAt:relTime(55), attempts:3, max:3, retryable:false },
  { id:'job_1004', tenantId:'t_pnx', type:'billing.retry', status:'failed', err:'card_declined', createdAt:relTime(120), attempts:2, max:5, retryable:true },
  { id:'job_1005', tenantId:'t_kkc', type:'delivery.announce', status:'failed', err:'Delivery Agent offline', createdAt:relTime(140), attempts:1, max:3, retryable:true },
  { id:'job_1006', tenantId:'t_pnx', type:'delivery.job', status:'dead_letter', err:'attempts exhausted', createdAt:relTime(220), attempts:5, max:5, retryable:false },
];

const INCIDENTS = [
  { id:'inc_01', title:'Billing provider elevated 5xx', severity:'high', status:'investigating', tenantId:null, startedAt:relTime(45) },
  { id:'inc_02', title:'Server Bot v1.7.x heartbeat drift', severity:'medium', status:'monitoring', tenantId:null, startedAt:relTime(180) },
];

const NOTIFS = [
  { id:'n1', severity:'critical', type:'runtime', title:'Server Bot offline', body:'Bangkok Survival server bot has not sent a heartbeat for 109 minutes.', tenantId:'t_bkk', at:relTime(14) },
  { id:'n2', severity:'high', type:'billing', title:'Payment failed', body:'Phuket Wasteland — card_declined on invoice inv_07', tenantId:'t_pnx', at:relTime(46) },
  { id:'n3', severity:'medium', type:'runtime', title:'Delivery Agent offline', body:'Khonkaen Outpost delivery agent offline for 4h.', tenantId:'t_kkc', at:relTime(60) },
  { id:'n4', severity:'medium', type:'billing', title:'Trial ending soon', body:'Hatyai Apocalypse trial ends in 3 days.', tenantId:'t_hdy', at:relTime(90) },
  { id:'n5', severity:'low', type:'security', title:'Setup token consumed', body:'Kanchanaburi Bridge server bot token activated from new machine.', tenantId:'t_knc', at:relTime(120) },
];

const SECURITY = [
  { id:'sec_1', type:'Setup token reused', severity:'high', tenantId:'t_bkk', ip:'203.0.113.20', at:relTime(30) },
  { id:'sec_2', type:'Failed login', severity:'medium', tenantId:null, ip:'203.0.113.45', at:relTime(120) },
  { id:'sec_3', type:'API key created', severity:'low', tenantId:'t_nak', ip:'203.0.113.10', at:relTime(180) },
];

const AUDIT_FOR = (tenantId) => ([
  { id:'a1', actor:'Kittisak P.', action:'restart.schedule', target:'restart_01', risk:'high', result:'blocked', at:relTime(18) },
  { id:'a2', actor:'system', action:'config.apply', target:'cfgjob_01', risk:'high', result:'failed', at:relTime(22) },
  { id:'a3', actor:'Kittisak P.', action:'config.save', target:'cfgjob_01', risk:'medium', result:'success', at:relTime(28) },
  { id:'a4', actor:'system', action:'heartbeat.stale', target:'rt_serverbot_01', risk:'medium', result:'warning', at:relTime(109) },
  { id:'a5', actor:'Owen (Owner)', action:'tenant.package.update', target:'sub_01', risk:'medium', result:'success', at:relTime(1440) },
]);

const PACKAGES = [
  { id:'pkg_preview', name:'Preview', price:0, tenants:1, currency:'THB' },
  { id:'pkg_starter', name:'Starter', price:590, tenants:2, currency:'THB' },
  { id:'pkg_growth', name:'Growth', price:1290, tenants:4, currency:'THB' },
  { id:'pkg_pro', name:'Pro', price:2490, tenants:4, currency:'THB' },
  { id:'pkg_ent', name:'Enterprise', price:4990, tenants:1, currency:'THB' },
];

// Flatten runtimes
const buildFleet = () => {
  const out = [];
  TENANTS.forEach(t => {
    out.push({
      id:`rt_del_${t.id}`, tenantId:t.id, tenantName:t.name,
      kind:'delivery', scope:'execute_only',
      ...t.delivery,
      latestVersion:'1.8.2',
      capabilities:['delivery_jobs','in_game_announce'],
    });
    out.push({
      id:`rt_bot_${t.id}`, tenantId:t.id, tenantName:t.name,
      kind:'server_bot', scope:'sync_only',
      ...t.serverBot,
      latestVersion:'1.8.2',
      capabilities:['log_sync','config_apply','backup','restart'],
    });
  });
  return out;
};

const FLEET = buildFleet();

const DASHBOARD = {
  generatedAt: NOW,
  platform:{ status:'degraded', riskLevel:'high', riskReasons:['3 server bots offline','2 unpaid invoices','1 incident investigating'] },
  tenants:{ total:12, active:9, preview:1, trial:1, suspended:1, atRisk:5 },
  revenue:{ currency:'THB', mrr:21890, activeSubscriptions:10, unpaidInvoices:2, failedPayments:2, trialEndingSoon:1 },
  runtime:{
    deliveryOnline: FLEET.filter(r=>r.kind==='delivery'&&r.status==='online').length,
    deliveryOffline: FLEET.filter(r=>r.kind==='delivery'&&r.status==='offline').length,
    botOnline: FLEET.filter(r=>r.kind==='server_bot'&&r.status==='online').length,
    botOffline: FLEET.filter(r=>r.kind==='server_bot'&&r.status==='offline').length,
    outdated: FLEET.filter(r=>r.version && r.version !== '1.8.2' && r.version !== '—').length,
    staleHeartbeats: 2,
  },
  ops:{ failedJobs: JOBS.filter(j=>j.status==='failed').length, deadLetter: JOBS.filter(j=>j.status==='dead_letter').length, pendingRestarts:2, failedConfig: JOBS.filter(j=>j.type.startsWith('config')&&j.status==='failed').length },
  security:{ openEvents: SECURITY.length, failedLogins24h:11, keysNeedingRotation:2 },
  support:{ openCases: TENANTS.reduce((s,t)=>s+t.openCases,0), highPriority:2, waitingOwner:2 },
};

Object.assign(window, { TENANTS, JOBS, INCIDENTS, NOTIFS, SECURITY, AUDIT_FOR, PACKAGES, FLEET, DASHBOARD, fmtTime, fmtAbs, NOW });
