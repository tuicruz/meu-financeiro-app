const $=id=>document.getElementById(id), money=n=>(Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),uid=()=>crypto.randomUUID(),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initial=[];
const cardBanks={bb:{name:'Banco do Brasil',suffix:'1483',due:10,best:'01/12'},bradesco:{name:'Bradesco',suffix:'1876',due:5,best:'19/11'},inter:{name:'Banco Inter',suffix:'1380',due:10,best:'04/12'}};
let moneyState={balances:{bradesco:818.32,inter:24.70,caixa:-280,bb:0,cash:280},moves:[],updatedAt:null},cardState={purchases:[],paidInvoices:[]},uberLedger={opening:null,moves:[]},uberSessions=[],uberTransfers=[],uberOpening={cash:0,digital:0,date:'',note:''},uberDraft=null,records=[],selected=new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0'),tab='resumo',sb=null,user=null,syncing=false,dirty=false;function load(){return records}function save(){if(!user||!loaded)return alert('Aguarde a sincronização antes de salvar.');dirty=true;render();scheduleSync()}function stateOf(r){return r.status||(r.paid?'paid':'pending')}function monthEntries(){return records.filter(r=>r.date.startsWith(selected)).sort((a,b)=>a.date.localeCompare(b.date)||a.description.localeCompare(b.description))}function monthName(){return new Date(`${selected}-15T12:00:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}function render(){renderCheckup(); renderMoney(); renderDashboard(); renderForecast55(); $('month').value=selected;$('monthTitle').textContent=monthName()[0].toUpperCase()+monthName().slice(1);const arr=monthEntries(),sum=(t,p)=>arr.filter(x=>x.type===t&&(!p||stateOf(x)==='paid')).reduce((s,x)=>s+Number(x.amount),0),rec=sum('receita'),out=sum('despesa'),paidOut=sum('despesa',true),pendingOut=out-paidOut;const us=uberSessions.filter(x=>x.data?.startsWith(selected)).reduce((a,r)=>{const c=uberCalc(r);a.bruto+=c.bruto;a.abastecido+=Number(r.valorAbastecido)||0;a.operacional+=c.lucro;return a},{bruto:0,abastecido:0,operacional:0});$('stats').innerHTML=[['Receitas recebidas',sum('receita',true),'positive'],['Uber faturado',us.bruto,'positive'],['Despesas do mês',out,'negative']].map(([t,v,c])=>`<div class="card"><label>${t}</label><strong class="${c}">${money(v)}</strong></div>`).join('');renderInvoiceDashboard();const line=r=>`<div class="entry" data-bank="${esc(r.account||'')}"><div><button type="button" class="quick-edit" data-quick-edit="${r.id}" title="Editar data de vencimento">${r.date.slice(8,10)}/${r.date.slice(5,7)} Editar</button></div><div><button type="button" class="quick-edit quick-name" data-quick-edit="${r.id}" title="Editar lançamento">${esc(r.description)}</button><small>${esc(r.category)}${r.estimated?' · estimado':''}${r.note?' · '+esc(r.note):''}</small></div><button type="button" data-quick-edit="${r.id}" title="Editar valor" class="value quick-edit ${r.type==='receita'?'positive':r.type==='despesa'?'negative':''}">${r.type==='receita'?'+':r.type==='despesa'?'−':''}${money(r.amount)}</button><div class="status"><button class="secondary" data-toggle="${r.id}" title="Alternar status"><span class="tag ${stateOf(r)==='paid'?'':stateOf(r)}">${stateOf(r)==='paid'?'Concluído':stateOf(r)==='overdue'?'Não pago':'Pendente'}</span></button></div><div class="actions"><button class="secondary" data-edit="${r.id}" aria-label="Editar">Editar</button><button class="secondary" data-repeat-entry="${r.id}" title="Copiar para o próximo mês">Repetir</button><button class="danger" data-del="${r.id}" aria-label="Excluir">×</button></div></div>`;$('upcoming').innerHTML=arr.filter(x=>x.type==='despesa'&&stateOf(x)!=='paid').length?arr.filter(x=>x.type==='despesa'&&stateOf(x)!=='paid').slice(0,12).map(line).join(''):'<p class="muted">Tudo em dia! Nenhuma conta pendente neste mês.</p>';$('entries').innerHTML=arr.filter(x=>($('filterType').value==='all'||x.type===$('filterType').value)&&($('filterStatus').value==='all'||stateOf(x)===$('filterStatus').value)&&(!$('filterBank')||$('filterBank').value==='all'||x.account===$('filterBank').value)).map(line).join('')||'<p class="muted">Nenhum lançamento.</p>';
$('debtCards').innerHTML='<p class="muted">Consulte os lançamentos e metas. Os saldos bancários devem ser conferidos nos bancos.</p>';
const goal=(name,total,current)=>`<div class="goal"><div class="toolbar"><b>${name}</b><span>${money(current)} / ${money(total)}</span></div><div class="progress"><span style="width:${Math.min(100,100*current/total)}%"></span></div></div>`;$('goals').innerHTML=goal('Reserva para acordo BB',13407.18,arr.filter(x=>x.type==='reserva'&&stateOf(x)==='paid').reduce((a,b)=>a+Number(b.amount),0))+goal('Meta de patrimônio em dinheiro',100000,0)+'<p class="muted">O progresso considera somente reservas marcadas como concluídas neste mês. A meta de R$ 100 mil começa zerada até você informar o saldo disponível.</p>';
}
function renderCheckup(){
 const month=selected;
 $('checkupMonth').textContent=monthName();
 // A previous unpaid obligation remains visible; it is not cloned or counted twice.
 const current=records.filter(r=>r.date.startsWith(month));
 const carry=records.filter(r=>r.date.slice(0,7)<month&&stateOf(r)!=='paid'&&r.type!=='reserva');
 const all=[...carry,...current].sort((a,b)=>a.date.localeCompare(b.date));
 const total=(filter)=>all.filter(filter).reduce((s,r)=>s+Number(r.amount),0);
 const pending=all.filter(r=>stateOf(r)!=='paid');
 $('checkupStats').innerHTML=[
 ['Resolvidos',all.filter(r=>stateOf(r)==='paid').length+' / '+all.length],
 ['A pagar',money(total(r=>r.type==='despesa'&&stateOf(r)!=='paid'))],
 ['A receber',money(total(r=>r.type==='receita'&&stateOf(r)!=='paid'))],
 ['Pendências antigas',String(carry.length)]
 ].map(([a,b])=>'<div class="card"><label>'+a+'</label><strong>'+b+'</strong></div>').join('');
 function lines(type){
 const a=all.filter(r=>r.type===type&&stateOf(r)!=='paid');
 return a.length?a.map(r=>`<div class="checkrow ${stateOf(r)}"><div><button type="button" class="quick-edit quick-name" data-quick-edit="${r.id}" title="Editar valor, descrição ou vencimento">${esc(r.description)}</button><small>${r.date.split('-').reverse().join('/')} ${r.date.slice(0,7)<month?' · De mês anterior':''} ${r.estimated?' · estimado':''}</small></div><div class="ctrl"><button type="button" class="quick-edit amt" data-quick-edit="${r.id}" title="Editar valor e vencimento">${money(r.amount)}</button><select aria-label="Situação de ${esc(r.description)}" data-status="${r.id}"><option value="pending" ${stateOf(r)==='pending'?'selected':''}>Pendente</option><option value="paid" ${stateOf(r)==='paid'?'selected':''}>${type==='receita'?'Recebido':'Pago'}</option><option value="overdue" ${stateOf(r)==='overdue'?'selected':''}>${type==='receita'?'Não recebido':'Não pago'}</option></select></div></div>`).join(''):'<p class="muted">Nenhum lançamento.</p>';
 }
 $('checkupOut').innerHTML=lines('despesa');
 $('checkupIn').innerHTML=lines('receita');
 $('checkupReserve').innerHTML=lines('reserva');
}
document.addEventListener('click',e=>{const el=e.target.closest('[data-quick-edit]');if(el)openEditor(el.dataset.quickEdit)});
/* Recorrência assistida: copia uma conta para o mês seguinte somente após confirmação.
   Não cria registros automaticamente, evitando duplicações. */
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-repeat-entry]');if(!b)return;
 const old=records.find(r=>r.id===b.dataset.repeatEntry);if(!old)return;
 const [y,m,d]=old.date.split('-').map(Number);
 const next=new Date(y,m,1),year=next.getFullYear(),month=String(next.getMonth()+1).padStart(2,'0');
 const day=String(Math.min(d,new Date(year,next.getMonth()+1,0).getDate())).padStart(2,'0');
 const nextDate=year+'-'+month+'-'+day;
 if(records.some(r=>r.date===nextDate&&r.description.trim().toLowerCase()===old.description.trim().toLowerCase()&&r.type===old.type))return alert('Já existe uma conta com essa descrição e data no próximo mês.');
 if(!confirm('Repetir "'+old.description+'" em '+nextDate.split('-').reverse().join('/')+'? Você poderá revisar antes de salvar.'))return;
 openEditor();$('description').value=old.description;$('amount').value=old.amount;$('date').value=nextDate;$('type').value=old.type;$('category').value=old.category||'';$('note').value=old.note||'';$('recordStatus').value='pending';$('paid').checked=false;$('entryAccount').value=old.account||'';
});

// v4.7: conciliação de lançamentos. Somente operações novas são aplicadas automaticamente.
function recordEffect(r){return r&&r.type!=='reserva'&&stateOf(r)==='paid'&&moneyAccounts[r.account]?{account:r.account,delta:Math.round(Number(r.amount)*(r.type==='receita'?1:-1)*100)/100}:null}
function reconcileRecord(before,after){
 // Efeito idempotente: registros antigos sem comprovante de conciliação não são debitados retroativamente.
 const previous=before?.balanceEffect||null;
 const desired=recordEffect(after);
 const wasPaid=before&&stateOf(before)==='paid';
 const legacyPaid=wasPaid&&!previous;
 const shouldApply=!!desired&&(!legacyPaid||!!previous);
 if(previous){moneyState.balances[previous.account]=Math.round((moneyState.balances[previous.account]-previous.delta)*100)/100}
 if(shouldApply){moneyState.balances[desired.account]=Math.round((moneyState.balances[desired.account]+desired.delta)*100)/100}
 if(after)after.balanceEffect=shouldApply?desired:null;
 if(previous||shouldApply){
  moneyState.updatedAt=new Date().toISOString();
  moneyState.moves.push({id:uid(),type:'entry-sync',account:desired?.account||previous.account,amount:Math.abs(desired?.delta||previous.delta),delta:shouldApply?desired.delta:-previous.delta,note:'Lançamento: '+(after?.description||before?.description||''),date:new Date().toISOString(),recordId:after?.id||before?.id});
 }
 return {applied:!!(previous||shouldApply),legacy:!!legacyPaid};
}
function changeRecordStatus(r,status){if(!user||!loaded)return alert('Aguarde a sincronização.');const before={...r};r.status=status;r.paid=status==='paid';if(status==='paid'&&r.type!=='reserva'&&!moneyAccounts[r.account]){const account=prompt('Qual conta foi usada? Digite: bradesco, inter, caixa, bb ou cash (dinheiro).','bradesco');if(!account||!moneyAccounts[account]){Object.assign(r,before);alert('Pagamento não alterado: informe uma conta válida.');return}r.account=account}reconcileRecord(before,r);save()}
document.addEventListener('change',e=>{const el=e.target.closest('[data-status]');if(!el)return;const r=records.find(x=>x.id===el.dataset.status);if(r){changeRecordStatus(r,el.value)}});
$('paid').addEventListener('change',e=>{if(e.target.checked)$('recordStatus').value='paid';else if($('recordStatus').value==='paid')$('recordStatus').value='pending'});
$('recordStatus').addEventListener('change',e=>$('paid').checked=e.target.value==='paid');
function showTab(t){tab=t;document.querySelectorAll('main>section').forEach(e=>e.classList.toggle('hidden',e.id!==t));document.querySelectorAll('[data-tab]').forEach(e=>e.classList.toggle('active',e.dataset.tab===t));render();if(t==='fiestao'){renderUber();showOpening();renderUberDraft();renderLedger()}if(t==='cartoes')renderCards()};document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));$('month').onchange=e=>{selected=e.target.value;render()};function moveMonth(n){const [y,m]=selected.split('-').map(Number),d=new Date(y,m-1+n,1);selected=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;render()}$('prev').onclick=()=>moveMonth(-1);$('next').onclick=()=>moveMonth(1);$('filterType').onchange=render;$('filterStatus').onchange=render;if($('filterBank'))$('filterBank').onchange=render;
function openEditor(id){const r=records.find(x=>x.id===id)||{id:'',description:'',amount:'',date:`${selected}-01`,type:'despesa',category:'',note:'',paid:false,status:'pending'};$('modalTitle').textContent=id?'Editar lançamento':'Novo lançamento';for(const k of ['description','amount','date','type','category','note'])$(k).value=r[k];$('paid').checked=stateOf(r)==='paid';$('recordStatus').value=stateOf(r);$('editId').value=r.id;$('entryAccount').value=r.account||'';$('modal').classList.remove('hidden')};$('add').onclick=()=>openEditor();$('addTop').onclick=()=>openEditor();$('close').onclick=()=>$('modal').classList.add('hidden');$('modal').onclick=e=>{if(e.target===$('modal'))$('modal').classList.add('hidden')};$('entryForm').onsubmit=e=>{e.preventDefault();const id=$('editId').value;const obj={id:id||uid(),description:$('description').value.trim(),amount:Number($('amount').value),date:$('date').value,type:$('type').value,category:$('category').value.trim(),note:$('note').value.trim(),paid:$('recordStatus').value==='paid'||$('paid').checked,status:$('recordStatus').value==='pending'&&$('paid').checked?'paid':$('recordStatus').value,estimated:false,account:$('entryAccount').value};if(!obj.description||!obj.date||!(obj.amount>0))return;if(!user||!loaded)return alert('Aguarde a sincronização dos dados antes de salvar.');const old=records.find(r=>r.id===id);if(obj.status==='paid'&&obj.type!=='reserva'&&!moneyAccounts[obj.account])return alert('Selecione a conta usada no pagamento ou recebimento.');const reconciliation=reconcileRecord(old,obj);if(reconciliation.legacy&&obj.status==='paid')alert('Este lançamento já estava pago antes da conciliação automática. O saldo não foi descontado novamente. Confira o extrato e ajuste apenas se necessário.');records=id?records.map(r=>r.id===id?obj:r):[...records,obj];$('modal').classList.add('hidden');save()};document.addEventListener('click',e=>{const b=e.target.closest('[data-toggle],[data-edit],[data-del]');if(!b)return;if(b.dataset.toggle){const r=records.find(x=>x.id===b.dataset.toggle);if(r){changeRecordStatus(r,stateOf(r)==='paid'?'pending':'paid')}}if(b.dataset.edit)openEditor(b.dataset.edit);if(b.dataset.del&&confirm('Excluir este lançamento?')){const old=records.find(r=>r.id===b.dataset.del);reconcileRecord(old,null);records=records.filter(r=>r.id!==b.dataset.del);save()}});
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({version:3,exportedAt:new Date().toISOString(),records,uberSessions,uberTransfers,uberOpening,uberDraft,uberLedger,cardState,moneyState},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`meu-financeiro-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};$('importBtn').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{if(!user||!loaded)return alert('Entre na sua conta antes de importar.');try{const j=JSON.parse(await e.target.files[0].text());if(!Array.isArray(j.records)||!j.records.every(r=>r.id&&r.date&&r.description&&Number.isFinite(Number(r.amount))&&['despesa','receita','reserva'].includes(r.type)))throw Error('Arquivo inválido');if(confirm('Substituir todos os lançamentos pelos do backup?')){records=j.records;uberSessions=Array.isArray(j.uberSessions)?j.uberSessions:[];uberTransfers=Array.isArray(j.uberTransfers)?j.uberTransfers:[];uberOpening=normalizeOpening(j.uberOpening);uberDraft=validUberDraft(j.uberDraft);uberLedger=normalizeLedger(j.uberLedger);cardState=normalizeCardState(j.cardState);moneyState=normalizeMoneyState(j.moneyState);save();renderUberDraft();showOpening();renderUber()}}catch(err){alert(err.message)}};$('reset').onclick=()=>{if(confirm('Apagar todos os lançamentos da sua conta? Exporte um backup antes.')){records=[];uberSessions=[];uberTransfers=[];uberOpening=normalizeOpening(null);uberDraft=null;uberLedger=normalizeLedger(null);cardState=normalizeCardState(null);moneyState=normalizeMoneyState(null);save();showOpening();renderUber()}};

// v4.4 — saldos informados. Não acessa bancos e não altera lançamentos antigos.
const moneyAccounts={bradesco:'Bradesco',inter:'Banco Inter',caixa:'Caixa Econômica',bb:'Banco do Brasil',cash:'Dinheiro em espécie'};
function normalizeMoneyState(x){const defaults={bradesco:818.32,inter:24.70,caixa:-280,bb:0,cash:280};const o=x&&typeof x==='object'?x:{};const b={};for(const k of Object.keys(moneyAccounts)){const n=Number(o.balances?.[k]);b[k]=o.balances&&o.balances[k]!==undefined&&Number.isFinite(n)?Math.round(n*100)/100:defaults[k]}return {balances:b,moves:Array.isArray(o.moves)?o.moves.filter(m=>m&&m.id&&moneyAccounts[m.account]&&Number.isFinite(Number(m.amount))):[],updatedAt:o.updatedAt||null}}
function renderMoney(){const panel=$('moneyPanel');if(!panel)return;const b=moneyState.balances,total=Object.entries(b).filter(([k])=>k!=='cash').reduce((sum,[,n])=>sum+Number(n||0),0),el=$('moneyTotal');el.textContent=money(total);el.classList.toggle('negative',total<0);$('moneyUpdated').textContent=moneyState.updatedAt?'Conferido: '+new Date(moneyState.updatedAt).toLocaleString('pt-BR'):'Saldos iniciais informados';$('moneyRows').innerHTML=Object.entries(moneyAccounts).map(([k,n])=>`<button type="button" class="money-bank money-bank-edit" data-bank-edit="${k}" title="Clique para ajustar o saldo de ${n}"><small>${n}</small><b class="${b[k]<0?'negative':''}">${money(b[k])}</b></button>`).join('');$('moneyHistory').innerHTML='<h3>Últimas movimentações</h3>'+moneyState.moves.slice(-20).reverse().map(m=>`<div class="money-history-item">${m.type==='entry-sync'?'':`<button type="button" class="secondary" data-money-undo="${esc(m.id)}">Desfazer</button>`}<b>${esc(m.note||m.type)}</b> · ${money(m.amount)}<br><small>${esc(m.account)}${m.dest?' → '+esc(m.dest):''} · ${new Date(m.date).toLocaleString('pt-BR')}</small></div>`).join('')||'<p class="muted">Nenhuma movimentação registrada.</p>'}
document.addEventListener('click',e=>{const b=e.target.closest('[data-bank-edit]');if(!b)return;const k=b.dataset.bankEdit;if(!moneyAccounts[k])return;const current=moneyState.balances[k];const raw=prompt(`Novo saldo de ${moneyAccounts[k]} (R$):`,current.toFixed(2).replace('.',','));if(raw===null)return;const clean=raw.trim().replace(/\s/g,'').replace(/^R\$/i,'').replace(/\./g,'').replace(',','.');if(!clean||!Number.isFinite(Number(clean)))return alert('Digite um saldo válido.');const value=Math.round(Number(clean)*100)/100;if(value===current)return;if(!user||!loaded)return alert('Aguarde o carregamento da nuvem.');moneyState.balances[k]=value;moneyState.moves.push({id:crypto.randomUUID(),type:'adjust',account:k,amount:Math.round((value-current)*100)/100,before:current,note:'Ajuste manual de saldo',date:new Date().toISOString()});moneyState.updatedAt=new Date().toISOString();save();});
const moneyOptions=Object.entries(moneyAccounts).map(([k,n])=>`<option value="${k}">${n}</option>`).join('');for(const id of ['moneyAdjustAccount','moneyMoveAccount','moneyMoveDest'])$(id).innerHTML=moneyOptions;
$('moneyMoveType').onchange=()=>{$('moneyDestLabel').classList.toggle('hidden',$('moneyMoveType').value!=='transfer')};
$('moneyAdjustForm').onsubmit=e=>{e.preventDefault();if(!user||!loaded)return alert('Aguarde o carregamento da nuvem.');const account=$('moneyAdjustAccount').value,value=Number($('moneyAdjustValue').value);if(!moneyAccounts[account]||!Number.isFinite(value))return alert('Informe um saldo válido.');const before=moneyState.balances[account];if(!confirm(`Confirmar saldo real de ${moneyAccounts[account]}: ${money(value)}?`))return;moneyState.balances[account]=Math.round(value*100)/100;moneyState.moves.push({id:uid(),type:'adjust',account,amount:value-before,before,after:value,note:'Conferência manual de saldo',date:new Date().toISOString()});moneyState.updatedAt=new Date().toISOString();$('moneyAdjustForm').reset();save()};
$('moneyMoveForm').onsubmit=e=>{e.preventDefault();if(!user||!loaded)return alert('Aguarde o carregamento da nuvem.');const type=$('moneyMoveType').value,account=$('moneyMoveAccount').value,dest=$('moneyMoveDest').value,amount=Math.round(Number($('moneyMoveAmount').value)*100)/100,note=$('moneyMoveNote').value.trim();if(!moneyAccounts[account]||!Number.isFinite(amount)||amount<=0||!note||(type==='transfer'&&account===dest))return alert('Confira os dados da movimentação.');if(!confirm('Esta movimentação já aconteceu e ainda NÃO está incluída no saldo informado?'))return;const delta=type==='income'?amount:-amount;moneyState.balances[account]=Math.round((moneyState.balances[account]+delta)*100)/100;if(type==='transfer')moneyState.balances[dest]=Math.round((moneyState.balances[dest]+amount)*100)/100;moneyState.moves.push({id:uid(),type,account,dest:type==='transfer'?dest:null,amount,note,date:new Date().toISOString()});moneyState.updatedAt=new Date().toISOString();$('moneyMoveForm').reset();$('moneyDestLabel').classList.add('hidden');save()};
document.addEventListener('click',e=>{const btn=e.target.closest('[data-money-undo]');if(!btn)return;const m=moneyState.moves.find(x=>x.id===btn.dataset.moneyUndo);if(!m||m.type==='entry-sync'||!confirm('Desfazer esta movimentação?'))return;if(m.type==='adjust'){moneyState.balances[m.account]=m.before}else{moneyState.balances[m.account]=Math.round((moneyState.balances[m.account]+(m.type==='income'?-m.amount:m.amount))*100)/100;if(m.type==='transfer')moneyState.balances[m.dest]=Math.round((moneyState.balances[m.dest]-m.amount)*100)/100}moneyState.moves=moneyState.moves.filter(x=>x.id!==m.id);moneyState.updatedAt=new Date().toISOString();save()});

// Supabase authentication and single-user cloud state. Never place secret/service-role keys here.
const PROJECT_URL='https://nrxjhjehcdbvloiydoiu.supabase.co';
let syncTimer=null,loaded=false;
const DEFAULT_PUBLIC_KEY='sb_publishable_OPmjxoAeqXmzbU0TSKGviQ_w_6qtnlc';
const getKey=()=>localStorage.getItem('mf-public-key')||DEFAULT_PUBLIC_KEY;
function msg(s){$('cloudMessage').textContent=s;$('authMessage').textContent=s}
function status(){$('syncLabel').textContent=user?'Conectado':'Acesso protegido';$('authGate').classList.toggle('hidden',!!user);document.querySelector('main').classList.toggle('hidden',!user);document.querySelector('header').classList.toggle('hidden',!user)}
function lock(){user=null;records=[];uberSessions=[];uberTransfers=[];uberOpening=normalizeOpening(null);uberDraft=null;uberLedger=normalizeLedger(null);cardState=normalizeCardState(null);moneyState=normalizeMoneyState(null);loaded=false;dirty=false;status();render()}
async function initCloud(){if(!window.supabase){msg('Não foi possível carregar a biblioteca do Supabase. Verifique a internet.');return}const key=getKey();if(!key){status();msg('Configure sua chave pública publishable na tela de acesso.');return}try{sb=window.supabase.createClient(PROJECT_URL,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data,error}=await sb.auth.getSession();if(error)throw error;user=data.session?.user||null;status();if(user)await fetchCloud();sb.auth.onAuthStateChange((event,session)=>{const next=session?.user||null;if(!next){lock();return}if(!user||user.id!==next.id){user=next;loaded=false;status();fetchCloud()}})}catch(e){msg('Falha na conexão: '+e.message)}}
async function fetchCloud(){if(!sb||!user)return;try{const {data,error}=await sb.from('finance_state').select('payload').eq('user_id',user.id).maybeSingle();if(error)throw error;records=Array.isArray(data?.payload?.records)?data.payload.records:[];uberSessions=Array.isArray(data?.payload?.uberSessions)?data.payload.uberSessions:[];uberTransfers=Array.isArray(data?.payload?.uberTransfers)?data.payload.uberTransfers:[];uberOpening=normalizeOpening(data?.payload?.uberOpening);uberDraft=validUberDraft(data?.payload?.uberDraft);uberLedger=normalizeLedger(data?.payload?.uberLedger);cardState=normalizeCardState(data?.payload?.cardState);moneyState=normalizeMoneyState(data?.payload?.moneyState);loaded=true;dirty=false;render();showOpening();renderUberDraft();renderUber();renderLedger();msg('Dados carregados da sua conta.')}catch(e){msg('Erro ao carregar dados: '+e.message)}}
async function syncCloud(){if(!sb||!user||!loaded||syncing)return;syncing=true;const snapshot=JSON.stringify({records,uberSessions,uberTransfers,uberOpening,uberDraft,uberLedger,cardState,moneyState});try{const {error}=await sb.from('finance_state').upsert({user_id:user.id,payload:JSON.parse(snapshot),updated_at:new Date().toISOString()});if(error)throw error;dirty=JSON.stringify({records,uberSessions,uberTransfers,uberOpening,uberDraft,uberLedger,cardState,moneyState})!==snapshot;msg(dirty?'Novas alterações aguardando sincronização.':'Alterações salvas na nuvem.')}catch(e){dirty=true;msg('Falha ao salvar: '+e.message)}finally{syncing=false;if(dirty&&JSON.stringify({records,uberSessions,uberTransfers,uberOpening,uberDraft,uberLedger,cardState,moneyState})!==snapshot)scheduleSync()}}
function scheduleSync(){if(!user||!loaded)return;clearTimeout(syncTimer);syncTimer=setTimeout(syncCloud,700)}
$('savePublicKey').onclick=()=>{const k=$('publicKey').value.trim();if(!k.startsWith('sb_publishable_')&&!k.startsWith('eyJ'))return msg('Informe apenas a chave pública publishable (ou anon).');localStorage.setItem('mf-public-key',k);location.reload()};
$('loginButton').onclick=async()=>{if(!sb)return msg('Configure primeiro a chave pública.');const email=$('loginEmail').value.trim(),password=$('loginPassword').value;if(!email||!password)return msg('Informe e-mail e senha.');$('loginButton').disabled=true;try{const {data,error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;user=data.user;status();await fetchCloud()}catch(e){msg('Não foi possível entrar: '+e.message)}finally{$('loginButton').disabled=false;$('loginPassword').value=''}};
$('signOut').onclick=async()=>{if(dirty)await syncCloud();if(sb)await sb.auth.signOut();lock();msg('Você saiu da sua conta.')};
$('syncNow').onclick=()=>syncCloud();
$('saveCloud').onclick=()=>{$('publicKey').value=$('sbKey').value;$('savePublicKey').click()};
$('signIn').onclick=()=>{showTab('resumo');msg('O login é feito na tela de acesso. Para sair, use o botão Sair.')};
$('sbUrl').value=PROJECT_URL;$('sbUrl').readOnly=true;
$('sbKey').value=getKey();
$('publicKey').value=getKey();
window.addEventListener('load',initCloud);
status();
render();
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});

// FIESTÃO — registros operacionais independentes das receitas financeiras.
const uberMoney=n=>money(Math.round((Number(n)||0)*100)/100);
const uberNum=id=>Number($(id).value)||0;
const uberDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function uberCalc(r){const km=r.kmRodados!==undefined?Math.max(0,Number(r.kmRodados)||0):Math.max(0,(Number(r.kmFinal)||0)-(Number(r.kmInicial)||0));const consumo=Number(r.consumo)||Number(localStorage.getItem('mf-uber-consumption'))||8.2;const preco=Number(r.preco)||0;const bruto=(Number(r.faturamento)||0)+(Number(r.gorjetas)||0);const combustivel=consumo>0?km/consumo*preco:0;return {km,bruto,combustivel,lucro:bruto-combustivel-(Number(r.outros)||0),horas:0,litros:consumo>0?km/consumo:0};}
function renderUber(){const month=$('uberMonth').value||selected;const rows=uberSessions.filter(x=>x.data?.startsWith(month)).sort((a,b)=>b.data.localeCompare(a.data));const sums=rows.reduce((a,r)=>{const c=uberCalc(r);a.bruto+=c.bruto;a.combustivel+=c.combustivel;a.lucro+=c.lucro;a.km+=c.km;a.abastecido+=Number(r.valorAbastecido)||0;return a},{bruto:0,combustivel:0,lucro:0,km:0,abastecido:0});$('uberStats').innerHTML=[['Faturamento',uberMoney(sums.bruto)],['Abastecimentos',uberMoney(sums.abastecido)],['Sobra após abastecer',uberMoney(sums.bruto-sums.abastecido)],['Resultado operacional estimado',uberMoney(sums.lucro)],['Km rodados',sums.km.toFixed(1)+' km']].map(([a,b])=>`<div class="card"><label>${a}</label><strong>${b}</strong></div>`).join('');$('uberRows').innerHTML=rows.map(r=>{const c=uberCalc(r);return `<div class="entry"><div><b>${esc(r.data.split('-').reverse().join('/'))}</b></div><div><b>${uberMoney(c.bruto)} faturados · ${c.km.toFixed(1)} km</b><small>Abastecimento ${uberMoney(r.valorAbastecido||0)} · ${esc(r.combustivelTipo||'não informado')} · resultado estimado ${uberMoney(c.lucro)}</small></div><div class="actions"><button class="secondary" data-v4-edit="${esc(r.id)}">Editar</button><button class="danger" data-v4-del="${esc(r.id)}">×</button></div></div>`}).join('')||'<p class="muted">Nenhum registro neste mês.</p>';if($('v4Consumption'))$('v4Consumption').value=localStorage.getItem('mf-uber-consumption')||'8.2';renderUberInsights55(rows,sums);}
$('uberMonth').value=selected;$('uberMonth').onchange=renderUber;
$('uberGoal').value=localStorage.getItem('mf-uber-goal')||'';$('uberGoal').oninput=()=>{localStorage.setItem('mf-uber-goal',$('uberGoal').value);renderUber()};
$('uberDate').value=uberDate();
function editUber(id){const r=uberSessions.find(x=>x.id===id);$('uberEditId').value=id||'';for(const [key,input] of Object.entries({data:'uberDate',inicio:'uberStart',fim:'uberEnd',kmInicial:'uberKmStart',kmFinal:'uberKmEnd',corridas:'uberRides',faturamento:'uberRevenue',gorjetas:'uberTips',consumo:'uberConsumption',preco:'uberPrice',dinheiro:'uberCash',digital:'uberDigital',combustivelTipo:'uberFuel',tanqueInicio:'uberTankStart',tanqueFim:'uberTankEnd',abasteceu:'uberRefueled',litrosAbastecidos:'uberLiters',valorAbastecido:'uberRefuelCost',outros:'uberOther',nota:'uberNote'}))$(input).value=r?.[key]??(key==='data'?uberDate():'');$('uberForm').scrollIntoView({behavior:'smooth'});}
// Expediente iniciado: gravado no mesmo payload do usuário, separado dos expedientes finalizados.
function validUberDraft(d){if(!d||typeof d!=='object'||!/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')||!/^\d{2}:\d{2}$/.test(d.start||'')||!Number.isFinite(Number(d.km))||Number(d.km)<0)return null;return {date:d.date,start:d.start,km:Number(d.km),fuel:d.fuel==='gasolina'?'gasolina':'etanol',savedAt:d.savedAt||''}}
function renderUberDraft(){if(!$('uberDraftStatus'))return;const d=uberDraft;$('uberDraftStatus').textContent=d?`Expediente iniciado em ${d.date.split('-').reverse().join('/')} às ${d.start} · ${d.km} km. Salvo na sua conta; confirme a mensagem de sincronização antes de fechar.`:'Nenhum expediente em andamento.';if(d){$('uberDraftDate').value=d.date;$('uberDraftStart').value=d.start;$('uberDraftKm').value=d.km;$('uberDraftFuel').value=d.fuel}else{$('uberDraftDate').value=uberDate();$('uberDraftStart').value='';$('uberDraftKm').value=''}}
$('uberDraftDate').value=uberDate();
$('uberDraftStartBtn').onclick=async()=>{if(!user||!loaded)return alert('Aguarde o carregamento dos dados da sua conta.');if(uberDraft&&!confirm('Já existe um expediente iniciado. Substituir os dados de início?'))return;const d=validUberDraft({date:$('uberDraftDate').value,start:$('uberDraftStart').value,km:$('uberDraftKm').value,fuel:$('uberDraftFuel').value,savedAt:new Date().toISOString()});if(!d||$('uberDraftKm').value==='')return alert('Informe data, horário e km inicial.');uberDraft=d;dirty=true;renderUberDraft();$('uberDraftStatus').textContent='Salvando início na nuvem…';await syncCloud();$('uberDraftStatus').textContent=dirty?'Não foi possível confirmar o salvamento. Confira sua conexão antes de fechar.':`Início salvo na nuvem: ${d.date.split('-').reverse().join('/')} às ${d.start}, ${d.km} km. Pode fechar e retomar depois.`};
$('uberDraftFinishBtn').onclick=()=>{if(!uberDraft)return alert('Inicie e salve um expediente primeiro.');const d=uberDraft;$('uberEditId').value='';$('uberDate').value=d.date;$('uberStart').value=d.start;$('uberKmStart').value=d.km;$('uberFuel').value=d.fuel;const now=new Date();$('uberEnd').value=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');$('uberForm').scrollIntoView({behavior:'smooth'});$('uberDraftStatus').textContent='Preencha o fim do expediente e toque em Salvar expediente. O início permanece salvo até concluir.'};
$('uberDraftCancelBtn').onclick=async()=>{if(!uberDraft)return;if(!confirm('Cancelar o início do expediente?'))return;uberDraft=null;dirty=true;renderUberDraft();await syncCloud();if(dirty)alert('Não foi possível confirmar o cancelamento na nuvem. Verifique sua conexão.')};
$('uberForm').onsubmit=e=>{e.preventDefault();if(!user||!loaded)return alert('Aguarde a sincronização da sua conta.');const v={id:$('uberEditId').value||uid(),data:$('uberDate').value,inicio:$('uberStart').value,fim:$('uberEnd').value,kmInicial:uberNum('uberKmStart'),kmFinal:uberNum('uberKmEnd'),corridas:uberNum('uberRides'),faturamento:uberNum('uberRevenue'),gorjetas:uberNum('uberTips'),consumo:uberNum('uberConsumption'),preco:uberNum('uberPrice'),dinheiro:uberNum('uberCash'),digital:uberNum('uberDigital'),combustivelTipo:$('uberFuel').value,tanqueInicio:$('uberTankStart').value,tanqueFim:$('uberTankEnd').value,abasteceu:$('uberRefueled').value,litrosAbastecidos:uberNum('uberLiters'),valorAbastecido:uberNum('uberRefuelCost'),outros:uberNum('uberOther'),nota:$('uberNote').value.trim()};if(!v.data||!v.inicio||!v.fim||v.kmFinal<v.kmInicial||v.consumo<=0||v.preco<=0)return alert('Confira datas, quilometragem, consumo e preço do combustível.');if(Math.abs(v.dinheiro+v.digital-(v.faturamento+v.gorjetas))>0.011)return alert('Dinheiro + saldo Uber deve ser igual ao faturamento + gorjetas. Confira os valores.');if(v.abasteceu==='sim'&&(!v.litrosAbastecidos||!v.valorAbastecido))return alert('Informe litros e valor abastecido.');uberSessions=uberSessions.filter(x=>x.id!==v.id).concat(v);uberDraft=null;save();renderUberDraft();$('uberForm').reset();$('uberEditId').value='';$('uberDate').value=uberDate();renderUber();};
$('uberCancel').onclick=()=>editUber(null);
document.addEventListener('click',e=>{const b=e.target.closest('[data-uber-edit],[data-uber-del]');if(!b)return;if(b.dataset.uberEdit)editUber(b.dataset.uberEdit);if(b.dataset.uberDel&&confirm('Excluir este expediente?')){uberSessions=uberSessions.filter(x=>x.id!==b.dataset.uberDel);save();renderUber();}});

// Fluxo de caixa FIESTÃO: depósitos/saques são transferências, não receitas novas.
function uberTotals(){let cash=uberOpening.cash,digital=uberOpening.digital,unclassified=0;for(const r of uberSessions){if(Number.isFinite(Number(r.dinheiro))&&Number.isFinite(Number(r.digital))&&r.dinheiro!==undefined&&r.digital!==undefined){cash+=Number(r.dinheiro);digital+=Number(r.digital)}else{unclassified+=uberCalc(r).bruto}}for(const t of uberTransfers){if(t.tipo==='deposito'||t.tipo==='ajuste_cash')cash-=Number(t.valor)||0;if(t.tipo==='saque')digital-=Number(t.valor)||0}return {cash,digital,unclassified}}
function renderUberBalances(){const t=uberTotals();$('uberBalances').innerHTML=[['Dinheiro em mãos (estimado)',uberMoney(t.cash)],['A receber da Uber (estimado)',uberMoney(t.digital)],['Ganhos antigos sem classificação',uberMoney(t.unclassified)]].map(([label,value])=>`<div class="card"><label>${label}</label><strong>${value}</strong></div>`).join('');const day=Number($('uberClosingDay').value)||20;$('uberClosingInfo').textContent=`Fechamento planejado no dia ${day} de cada mês. A data real do saque depende da Uber; registre somente quando o dinheiro chegar.`;$('uberTransferRows').innerHTML=uberTransfers.slice().sort((a,b)=>b.data.localeCompare(a.data)).map(t=>`<div class="entry"><div><b>${esc(t.data)}</b></div><div>${esc(t.tipo==='deposito'?'Depósito em banco':t.tipo==='saque'?'Saque Uber recebido':'Ajuste dinheiro')}<small>${esc(t.nota||'')}</small></div><div>${uberMoney(t.valor)}</div><div class="actions"><button class="danger" data-transfer-del="${esc(t.id)}">×</button></div></div>`).join('')||'<p class="muted">Nenhuma movimentação registrada.</p>'}
$('uberClosingDay').value=localStorage.getItem('mf-uber-close-day')||'20';$('uberClosingDay').onchange=()=>{localStorage.setItem('mf-uber-close-day',$('uberClosingDay').value);renderUber()};
$('uberTransferDate').value=uberDate();
$('uberTransferForm').onsubmit=e=>{e.preventDefault();if(!user||!loaded)return alert('Aguarde carregar os dados da nuvem.');const tipo=$('uberTransferType').value,valor=uberNum('uberTransferAmount'),data=$('uberTransferDate').value;if(!data||!(valor>0))return alert('Confira data e valor.');const bal=uberTotals();if(valor>(tipo==='saque'?bal.digital:bal.cash)+0.01)return alert('Valor maior que o saldo disponível. Confira os registros anteriores.');const transfer={id:uid(),tipo,valor,data,nota:$('uberTransferNote').value.trim()};
if($('uberAutoEntry').checked){
 const label=tipo==='saque'?'Repasse Uber recebido':tipo==='deposito'?'Depósito de dinheiro Uber':'Dinheiro Uber usado fora das corridas';
 const rec={id:uid(),description:label,amount:valor,date:data,type:'receita',category:'Uber / FIESTÃO',note:`Movimentação FIESTÃO ${transfer.id}. Valor recebido/transferido, não ganho adicional. ${transfer.nota}`.trim(),paid:true,status:'paid',estimated:false,uberTransferId:transfer.id};
 // A cash adjustment is not an incoming bank receipt.
 if(tipo!=='ajuste_cash'){records.push(rec);transfer.financeRecordId=rec.id}
}
uberTransfers.push(transfer);save();$('uberTransferForm').reset();$('uberTransferDate').value=uberDate();renderUber()};
document.addEventListener('click',e=>{const b=e.target.closest('[data-transfer-del]');if(b&&confirm('Excluir esta movimentação?')){const t=uberTransfers.find(x=>x.id===b.dataset.transferDel);if(t?.financeRecordId)records=records.filter(r=>r.id!==t.financeRecordId);uberTransfers=uberTransfers.filter(t=>t.id!==b.dataset.transferDel);save();renderUber()}});

// v3.3: opening balances are stock amounts, not trip revenue.
function normalizeOpening(o){return {cash:Number.isFinite(Number(o?.cash))?Math.max(0,Number(o.cash)):0,digital:Number.isFinite(Number(o?.digital))?Math.max(0,Number(o.digital)):0,date:typeof o?.date==='string'?o.date:'',note:typeof o?.note==='string'?o.note:''}}
function showOpening(){if(!$('uberOpeningCash'))return;$('uberOpeningCash').value=uberOpening.cash.toFixed(2);$('uberOpeningDigital').value=uberOpening.digital.toFixed(2);$('uberOpeningDate').value=uberOpening.date||uberDate();$('uberOpeningNote').value=uberOpening.note||'';$('uberOpeningSummary').textContent=uberOpening.date?`Saldo inicial registrado em ${uberOpening.date.split('-').reverse().join('/')}. Não entra no faturamento nem no lucro.`:'Nenhum saldo inicial configurado.'}
$('uberOpeningForm').onsubmit=e=>{e.preventDefault();if(!user||!loaded)return alert('Aguarde os dados carregarem da nuvem.');const cash=uberNum('uberOpeningCash'),digital=uberNum('uberOpeningDigital'),date=$('uberOpeningDate').value;if(!date||cash<0||digital<0)return alert('Confira os valores e a data.');if(!confirm(`Salvar saldos iniciais de ${uberMoney(cash)} em espécie e ${uberMoney(digital)} na Uber? Não serão contabilizados como novos ganhos.`))return;uberOpening={cash,digital,date,note:$('uberOpeningNote').value.trim()};save();renderUber();showOpening();};
showOpening();

// v4: cadastro simples, compatível com expedientes antigos e com o mesmo backup.
$('v4Date').value=uberDate();
$('v4Consumption').value=localStorage.getItem('mf-uber-consumption')||'8.2';
$('v4Consumption').onchange=()=>{const n=Number($('v4Consumption').value);if(n>0){localStorage.setItem('mf-uber-consumption',String(n));renderUber();render()}};
$('v4Form').onsubmit=e=>{e.preventDefault();if(!user||!loaded)return alert('Entre na sua conta e aguarde a sincronização.');const data=$('v4Date').value,digital=Number($('v4Digital').value),dinheiro=Number($('v4Cash').value),faturamento=digital+dinheiro,valorAbastecido=Number($('v4Refuel').value||0),preco=Number($('v4Price').value||0),kmRodados=Number($('v4Km').value),consumo=Number($('v4Consumption').value);if(!data||![digital,dinheiro,faturamento,valorAbastecido,preco,kmRodados,consumo].every(Number.isFinite)||faturamento<0||valorAbastecido<0||kmRodados<0||consumo<=0||preco<0)return alert('Confira os valores informados.');if(digital<0||dinheiro<0)return alert('Recebimentos não podem ser negativos.');if(kmRodados>0&&preco<=0)return alert('Informe o preço por litro para estimar o custo do combustível.');const id=$('v4Id').value||uid();if(uberLedger.opening&&data<uberLedger.opening.date)return alert('Este dia é anterior à data de início do novo controle. Não pode alterar o saldo atual.');const v={id,data,faturamento,digital,dinheiro,valorAbastecido,preco,kmRodados,consumo,combustivelTipo:$('v4Fuel').value,versao:41};uberSessions=uberSessions.filter(x=>x.id!==id).concat(v);save();$('v4Form').reset();$('v4Id').value='';$('v4Date').value=uberDate();$('v4Consumption').value=localStorage.getItem('mf-uber-consumption')||'8.2';renderUber();renderLedger();};
$('v4Clear').onclick=()=>{$('v4Form').reset();$('v4Id').value='';$('v4Date').value=uberDate();$('v4Consumption').value=localStorage.getItem('mf-uber-consumption')||'8.2'};
document.addEventListener('click',e=>{const b=e.target.closest('[data-v4-edit],[data-v4-del]');if(!b)return;const id=b.dataset.v4Edit||b.dataset.v4Del;const r=uberSessions.find(x=>x.id===id);if(!r)return;if(b.dataset.v4Del){if(confirm('Excluir este dia do FIESTÃO?')){uberSessions=uberSessions.filter(x=>x.id!==id);save();renderUber();renderLedger()}return;}if(r.versao!==41){if(!confirm('Registro antigo: confirme que os valores digitais e em espécie estão corretos. A edição converterá o registro para o novo formato. Continuar?'))return;}const c=uberCalc(r);$('v4Id').value=r.id;$('v4Date').value=r.data;$('v4Digital').value=r.versao===41?r.digital:(r.digital??c.bruto);$('v4Cash').value=r.versao===41?r.dinheiro:(r.dinheiro??0);$('v4Refuel').value=r.valorAbastecido||0;$('v4Price').value=r.preco||'';$('v4Km').value=c.km;$('v4Fuel').value=r.combustivelTipo||'etanol';$('v4Consumption').value=r.consumo||localStorage.getItem('mf-uber-consumption')||'8.2';$('v4Form').scrollIntoView({behavior:'smooth'});});

// v4.1: livro-caixa simples, separado do faturamento e das receitas.
function normalizeLedger(x){const o=x&&typeof x==='object'?x:{};const opening=o.opening&&/^\d{4}-\d{2}-\d{2}$/.test(o.opening.date||'')?{date:o.opening.date,digital:Number(o.opening.digital)||0,cash:Number(o.opening.cash)||0}:null;return {opening,moves:Array.isArray(o.moves)?o.moves.filter(m=>m&&m.id&&m.date&&Number.isFinite(Number(m.amount))):[]}}
function ledgerEvents(){const op=uberLedger.opening;if(!op)return [];const events=[];for(const r of uberSessions){if(r.versao!==41||r.data<op.date)continue;events.push({date:r.data,id:r.id,kind:'day',digital:Number(r.digital)||0,cash:Number(r.dinheiro)||0,refuel:Number(r.valorAbastecido)||0})}for(const m of uberLedger.moves){if(m.date<op.date)continue;events.push({date:m.date,id:m.id,kind:'move',...m})}return events.sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)))}
function ledgerBalances(){const o=uberLedger.opening;if(!o)return null;let digital=o.digital,cash=o.cash,bradesco=0;for(const e of ledgerEvents()){if(e.kind==='day'){digital+=e.digital-e.refuel;cash+=e.cash}else if(e.type==='uber_bradesco'){digital-=e.amount;bradesco+=e.amount}else if(e.type==='cash_bradesco'){cash-=e.amount;bradesco+=e.amount}else if(e.type==='adjust_uber'){digital=e.amount}else if(e.type==='adjust_cash'){cash=e.amount}}return {digital,cash,bradesco}}
function ledgerTransfersMonth(month){return uberLedger.moves.filter(m=>m.date?.startsWith(month)&&['uber_bradesco','cash_bradesco'].includes(m.type)).reduce((a,m)=>a+Number(m.amount||0),0)}
function renderLedger(){if(!$('ledgerBalances'))return;const o=uberLedger.opening;const b=ledgerBalances();$('ledgerInfo').textContent=o?'Controle iniciado em '+o.date.split('-').reverse().join('/')+'. Os registros anteriores não alteram estes saldos.':'Configure os saldos reais uma única vez para iniciar. Não registre corridas antigas novamente.';$('ledgerOpeningForm').querySelector('button').textContent=o?'Alterar ponto de partida (cuidado)':'Confirmar saldos iniciais';if(o){$('ledgerStart').value=o.date;$('ledgerDigital').value=o.digital;$('ledgerCash').value=o.cash}else{$('ledgerStart').value=uberDate();$('ledgerDigital').value='';$('ledgerCash').value=''}$('ledgerBalances').innerHTML=b?[['Conta Uber (calculado)',b.digital],['Dinheiro em espécie',b.cash],['Enviado ao Bradesco desde início',b.bradesco]].map(([k,v])=>`<div class="card"><label>${k}</label><strong>${uberMoney(v)}</strong></div>`).join(''):'<p class="muted">Aguardando saldos iniciais.</p>';$('ledgerMoves').innerHTML=uberLedger.moves.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(m=>`<div class="entry"><div>${esc(m.date)}</div><div><b>${esc({uber_bradesco:'Uber → Bradesco',cash_bradesco:'Espécie → Bradesco',adjust_uber:'Conferência Uber',adjust_cash:'Conferência espécie'}[m.type]||m.type)}</b><small>${esc(m.note||'')}</small></div><div>${uberMoney(m.amount)}</div><div class="actions"><button class="danger" data-ledger-del="${esc(m.id)}">×</button></div></div>`).join('')||'<p class="muted">Nenhuma movimentação.</p>'}
$('ledgerMoveDate').value=uberDate();
$('ledgerOpeningForm').onsubmit=e=>{e.preventDefault();if(!user||!loaded)return alert('Aguarde os dados da nuvem.');const date=$('ledgerStart').value,digital=Number($('ledgerDigital').value),cash=Number($('ledgerCash').value);if(!date||![digital,cash].every(Number.isFinite)||digital<0||cash<0)return alert('Confira os saldos.');if(uberLedger.opening&&!confirm('ATENÇÃO: alterar o ponto de partida recalcula todos os saldos e pode causar divergências. Continuar?'))return;if(!confirm('Conferiu os saldos reais e a data no banco Uber e no dinheiro vivo?'))return;uberLedger.opening={date,digital,cash};save();renderLedger();render()};
$('ledgerMoveForm').onsubmit=e=>{e.preventDefault();if(!user||!loaded)return alert('Aguarde os dados da nuvem.');const type=$('ledgerMoveType').value,date=$('ledgerMoveDate').value,amount=Number($('ledgerMoveAmount').value),note=$('ledgerMoveNote').value.trim(),o=uberLedger.opening;if(!o)return alert('Configure primeiro os saldos iniciais.');if(!date||date<o.date||!Number.isFinite(amount)||amount<0||(type.startsWith('adjust')?!note:amount<=0))return alert('Confira data, valor e motivo (obrigatório para ajustes).');if(['uber_bradesco','cash_bradesco'].includes(type)){const b=ledgerBalances();if(amount>(type==='uber_bradesco'?b.digital:b.cash)+0.01)return alert('Valor maior que o saldo calculado. Confira o saldo antes de registrar.');}if(!confirm('A movimentação já aconteceu de verdade? Registrar '+uberMoney(amount)+'?'))return;uberLedger.moves.push({id:uid(),date,type,amount,note});save();$('ledgerMoveForm').reset();$('ledgerMoveDate').value=uberDate();renderLedger();render()};
document.addEventListener('click',e=>{const b=e.target.closest('[data-ledger-del]');if(!b)return;if(!confirm('Excluir esta movimentação? Os saldos serão recalculados.'))return;uberLedger.moves=uberLedger.moves.filter(m=>m.id!==b.dataset.ledgerDel);save();renderLedger();render()});


// v4.2 — cartões: registro independente, sem lançar duplicado em records.

function normalizeCardState(x){const o=x&&typeof x==='object'?x:{};return {purchases:Array.isArray(o.purchases)?o.purchases.filter(p=>p&&p.id&&cardBanks[p.bank]&&/^\d{4}-\d{2}$/.test(p.firstMonth||'')&&Number(p.amount)>0&&Number.isInteger(Number(p.installments))&&Number(p.installments)>0):[],paidInvoices:Array.isArray(o.paidInvoices)?o.paidInvoices.filter(p=>p&&cardBanks[p.bank]&&/^\d{4}-\d{2}$/.test(p.month||'')):[]}}
function addCardMonths(month,offset){const [y,m]=month.split('-').map(Number);const d=new Date(y,m-1+offset,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function cardCents(v){return Math.round(Number(v)*100)}
function cardPart(p,i){const cents=cardCents(p.amount),base=Math.floor(cents/Number(p.installments));return (base+(i< (cents-base*Number(p.installments))?1:0))/100}
function cardInvoice(bank,month){const lines=[];for(const p of cardState.purchases){if(p.bank!==bank)continue;for(let i=0;i<Number(p.installments);i++){if(addCardMonths(p.firstMonth,i)===month){lines.push({p,index:i,amount:cardPart(p,i)});break}}}return {lines,total:lines.reduce((s,x)=>s+x.amount,0),paid:cardState.paidInvoices.some(x=>x.bank===bank&&x.month===month)}}
function cardLegacyForecast(bank,month){if(bank!=='bb')return null;return records.find(r=>r.type==='despesa'&&r.category==='Cartão'&&r.date?.startsWith(month)&&/Banco do Brasil/i.test(r.description||''))||null}
function renderInvoiceDashboard(){const node=$('invoiceDashboardRows');if(!node)return;const invoices=Object.keys(cardBanks).map(bank=>({bank,...cardInvoice(bank,selected),forecast:cardLegacyForecast(bank,selected)})).filter(x=>x.total>0||x.forecast);node.innerHTML=invoices.length?invoices.map(x=>`<div class="card-invoice"><div><b>${esc(cardBanks[x.bank].name)}</b><small>Vence dia ${cardBanks[x.bank].due} · ${x.forecast?'Previsão já registrada em Minhas contas':x.lines.length+' compra(s) nesta fatura'}</small></div><div><strong class="${x.paid?'positive':'negative'}">${money(x.forecast?Number(x.forecast.amount):x.total)}</strong><small>${x.forecast?(stateOf(x.forecast)==='paid'?'✓ Paga':'Pendente · previsão'):(x.paid?'✓ Paga':'Pendente')}</small></div></div>`).join(''):'<p class="muted">Nenhuma compra cadastrada para este mês. Use a aba Cartões para começar.</p>'}
function renderCards(){const month=$('cardMonth').value||selected;$('cardMonth').value=month;const invoices=Object.keys(cardBanks).map(bank=>({bank,...cardInvoice(bank,month),forecast:cardLegacyForecast(bank,month)}));$('cardSummary').innerHTML=[['Total previsto + novas compras',invoices.reduce((s,x)=>s+x.total+Number(x.forecast?.amount||0),0)],['Ainda falta pagar',invoices.reduce((s,x)=>s+(x.paid?0:x.total)+(x.forecast&&stateOf(x.forecast)!=='paid'?Number(x.forecast.amount):0),0)],['Faturas pagas',invoices.reduce((s,x)=>s+(x.paid?x.total:0)+(x.forecast&&stateOf(x.forecast)==='paid'?Number(x.forecast.amount):0),0)]].map(([label,value])=>`<div class="card"><label>${label}</label><strong>${money(value)}</strong></div>`).join('');$('cardInvoices').innerHTML=invoices.map(x=>{const b=cardBanks[x.bank];return `<div class="card-invoice"><div><b>${esc(b.name)} · •••• ${b.suffix}</b><small>Vencimento: dia ${b.due} · Melhor compra no ciclo atual: ${b.best}</small><small>${x.forecast?'Previsão anterior já existente em Minhas contas: '+money(x.forecast.amount)+' · '+(stateOf(x.forecast)==='paid'?'paga':'pendente')+' (não detalhada por compra). ':''}${x.lines.length?x.lines.map(l=>esc(l.p.description)+' ('+(l.index+1)+'/'+l.p.installments+') '+money(l.amount)).join(' · '):'Sem novas compras detalhadas nesta fatura'}</small></div><div class="actions"><strong class="${x.paid?'positive':''}">${money(x.total+Number(x.forecast?.amount||0))}</strong>${x.forecast?`<button type="button" class="secondary" data-quick-edit="${x.forecast.id}">Editar fatura</button>`:''}${x.total>0?`<button type="button" class="${x.paid?'secondary':''}" data-card-pay="${x.bank}" data-card-month="${month}">${x.paid?'✓ Paga · Desfazer':'Marcar paga'}</button>`:''}</div></div>`}).join('');$('cardPurchases').innerHTML=cardState.purchases.slice().sort((a,b)=>b.buyDate.localeCompare(a.buyDate)).map(p=>`<div class="card-invoice"><div><b>${esc(p.description)}</b><small>${esc(cardBanks[p.bank].name)} · ${p.installments}× · total ${money(p.amount)}</small><small>Primeira fatura ${p.firstMonth.split('-').reverse().join('/')} · compra ${p.buyDate.split('-').reverse().join('/')}</small></div><div class="actions"><button class="secondary" data-card-edit="${esc(p.id)}">Editar</button><button class="danger" data-card-del="${esc(p.id)}">Excluir</button></div></div>`).join('')||'<p class="muted">Nenhuma compra cadastrada.</p>'}
function cardClear(){ $('cardPurchaseForm').reset();$('cardEditId').value='';$('cardBuyDate').value=new Date().toLocaleDateString('en-CA');$('cardFirstMonth').value=selected;}
$('cardMonth').value=selected;cardClear();
$('cardClear').onclick=cardClear;
$('cardMonth').onchange=renderCards;
$('goCards').onclick=()=>showTab('cartoes');
$('cardPurchaseForm').onsubmit=e=>{e.preventDefault();if(!user||!loaded)return alert('Aguarde a sincronização.');const id=$('cardEditId').value||uid(),bank=$('cardBank').value,description=$('cardDescription').value.trim(),amount=Number($('cardAmount').value),installments=Number($('cardInstallments').value),buyDate=$('cardBuyDate').value,firstMonth=$('cardFirstMonth').value;if(!cardBanks[bank]||!description||!Number.isFinite(amount)||amount<=0||!Number.isInteger(installments)||installments<1||installments>120||!/^\d{4}-\d{2}-\d{2}$/.test(buyDate)||!/^\d{4}-\d{2}$/.test(firstMonth))return alert('Confira os dados da compra.');if(cardState.paidInvoices.some(x=>x.bank===bank&&Array.from({length:installments},(_,i)=>addCardMonths(firstMonth,i)).includes(x.month))&&!confirm('Esta compra afeta uma fatura já marcada como paga. Você precisará conferir os valores. Continuar?'))return;cardState.purchases=cardState.purchases.filter(p=>p.id!==id).concat({id,bank,description,amount,installments,buyDate,firstMonth});save();cardClear();renderCards()};
document.addEventListener('click',e=>{const b=e.target.closest('[data-card-pay],[data-card-edit],[data-card-del]');if(!b)return;if(b.dataset.cardPay){const bank=b.dataset.cardPay,month=b.dataset.cardMonth,inv=cardInvoice(bank,month);if(inv.total<=0)return;const paid=inv.paid;if(!confirm(paid?'Desfazer o pagamento desta fatura?':'A fatura foi paga de verdade no banco? Confirmar pagamento de '+money(inv.total)+'?'))return;cardState.paidInvoices=cardState.paidInvoices.filter(x=>!(x.bank===bank&&x.month===month));if(!paid)cardState.paidInvoices.push({bank,month,paidAt:new Date().toISOString()});save();renderCards();return}const id=b.dataset.cardEdit||b.dataset.cardDel,p=cardState.purchases.find(x=>x.id===id);if(!p)return;if(b.dataset.cardDel){if(!confirm('Excluir a compra e todas as parcelas futuras?'))return;cardState.purchases=cardState.purchases.filter(x=>x.id!==id);save();renderCards();return}$('cardEditId').value=p.id;$('cardBank').value=p.bank;$('cardDescription').value=p.description;$('cardAmount').value=p.amount;$('cardInstallments').value=p.installments;$('cardBuyDate').value=p.buyDate;$('cardFirstMonth').value=p.firstMonth;$('cardPurchaseForm').scrollIntoView({behavior:'smooth'})});
function applyTheme(){
 document.body.dataset.theme='professional';
 const mode=localStorage.getItem('mf-ui-mode')||'auto';
 document.body.dataset.uiMode=mode;
 $('themeToggle').textContent=mode==='light'?'Tema claro':mode==='dark'?'Tema escuro':'Tema automático';
 $('themeToggle').title='Alternar tema: automático, claro e escuro';
}
$('themeToggle').onclick=()=>{const current=localStorage.getItem('mf-ui-mode')||'auto';localStorage.setItem('mf-ui-mode',current==='auto'?'light':current==='light'?'dark':'auto');applyTheme()};
applyTheme();



$('appVersion').textContent='v5.5.3';

/* v5.1 dashboard — read-only summaries, existing mutation handlers remain authoritative */
function renderDashboard(){
 const hero=$('dashboardHero');if(!hero)return;
 const today=new Date(),greeting=today.getHours()<12?'Bom dia':today.getHours()<18?'Boa tarde':'Boa noite';
 hero.innerHTML='<div><h2>'+greeting+'!</h2><p>'+today.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' · Resumo financeiro</p></div>';
 const arr=monthEntries(), recent=[...arr].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
 $('dashboardRecent').innerHTML=recent.length?recent.map(r=>'<div class="dashboard-line"><div><b>'+esc(r.description)+'</b><small>'+esc(r.category||'Sem categoria')+' · '+r.date.split('-').reverse().join('/')+'</small></div><strong class="'+(r.type==='receita'?'positive':'negative')+'">'+(r.type==='receita'?'+':'−')+money(r.amount)+'</strong></div>').join(''):'<p class="muted">Sem lançamentos neste mês.</p>';
 const expenses=arr.filter(r=>r.type==='despesa'),groups={};expenses.forEach(r=>{const k=r.category||'Outros';groups[k]=(groups[k]||0)+Number(r.amount||0)});const total=Object.values(groups).reduce((a,b)=>a+b,0);
 $('dashboardCategories').innerHTML=total?Object.entries(groups).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([name,value])=>'<div style="margin:13px 0"><div class="dashboard-line" style="border:0;padding:0"><span>'+esc(name)+'</span><strong>'+money(value)+' · '+(100*value/total).toFixed(1)+'%</strong></div><div class="dashboard-bar"><span style="width:'+(100*value/total).toFixed(1)+'%"></span></div></div>').join(''):'<p class="muted">Sem despesas registradas neste mês.</p>';

}
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-dashboard-action]');if(!el)return;
 const action=el.dataset.dashboardAction;
 if(action==='new')openEditor();
 else if(action==='transfer'){showTab('fiestao');$('ledgerMoveForm').scrollIntoView({behavior:'smooth'});$('ledgerMoveAmount').focus()}
 else if(action==='pay'||action==='receive'){showTab('lancamentos');openEditor();$('type').value=action==='pay'?'despesa':'receita';$('description').focus()}
 else if(action==='uber')showTab('fiestao');
 else if(action==='cards')showTab('cartoes');
 else if(action==='goals')showTab('dividas');
 else if(action==='entries')showTab('lancamentos');
});

/* v5.2 mobile navigation */
(function(){
 const nav=document.querySelector('main .tabs'),more=document.getElementById('mobileMore');
 if(!nav||!more)return;
 const close=()=>{nav.classList.remove('mobile-open');more.setAttribute('aria-expanded','false')};
 more.addEventListener('click',()=>{const open=nav.classList.toggle('mobile-open');more.setAttribute('aria-expanded',String(open))});
 nav.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',close));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 document.addEventListener('click',e=>{if(!nav.contains(e.target))close()});
})();

/* Meu Financeiro 5.5 — read-only analytics and safe exports.
   No automatic mutation of balances, Uber ledger or historical records. */
function renderForecast55(){
 const target=$('forecastSummary'),alerts=$('dueAlerts');if(!target||!alerts)return;
 const bank=Object.entries(moneyState.balances).filter(([k])=>k!=='cash').reduce((a,[,v])=>a+Number(v||0),0);
 const today=new Date(),end=new Date(today.getFullYear(),today.getMonth()+1,0,23,59,59);
 const due=records.filter(r=>r.type!=='reserva'&&stateOf(r)!=='paid'&&r.date&&new Date(r.date+'T12:00:00')<=end);
 const expenses=due.filter(r=>r.type==='despesa').reduce((a,r)=>a+Number(r.amount||0),0);
 const income=due.filter(r=>r.type==='receita').reduce((a,r)=>a+Number(r.amount||0),0);
 target.innerHTML='<div class="dashboard-line"><span>Saldo bancário informado</span><strong>'+money(bank)+'</strong></div><div class="dashboard-line"><span>A pagar até o fim do mês (inclui atrasadas)</span><strong>'+money(expenses)+'</strong></div><div class="dashboard-line"><span>A receber até o fim do mês</span><strong>'+money(income)+'</strong></div><div class="dashboard-line"><b>Saldo projetado</b><strong>'+money(bank-expenses+income)+'</strong></div><p class="muted">Estimativa: não inclui pagamentos de cartões não lançados como contas, nem transferências futuras do Uber. Confira os saldos reais.</p>';
 const soon=due.filter(r=>r.type==='despesa'&&new Date(r.date+'T12:00:00')<=new Date(today.getTime()+7*86400000)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6);
 alerts.innerHTML=soon.length?'<h3>Vencimentos próximos e atrasados</h3>'+soon.map(r=>'<div class="due-alert"><b>'+esc(r.description)+'</b> · '+money(r.amount)+'<br><small>'+r.date.split('-').reverse().join('/')+(r.date<today.toLocaleDateString('sv-SE')?' · Atrasada':' · Pendente')+'</small></div>').join(''):'<p class="muted">Nenhuma despesa vencida ou com vencimento nos próximos 7 dias.</p>';
}
function renderUberInsights55(rows,sums){
 const el=$('uberInsights');if(!el)return;
 let hours=0,digital=0,cash=0;
 for(const r of rows){
  digital+=Number(r.digital||r.faturamentoDigital||0);
  cash+=Number(r.dinheiro||r.cash||0);
  const a=r.inicio||r.start,b=r.fim||r.end;
  if(/^\d\d:\d\d$/.test(a||'')&&/^\d\d:\d\d$/.test(b||'')){
   const [ah,am]=a.split(':').map(Number),[bh,bm]=b.split(':').map(Number);
   hours+=((bh*60+bm-ah*60-am+1440)%1440)/60;
  }
 }
 const perKm=sums.km>0?sums.bruto/sums.km:null;
 el.textContent='Ganho bruto por km: '+(perKm===null?'sem quilometragem':money(perKm)+'/km')+' · Ganho bruto por hora: '+(hours>0?money(sums.bruto/hours)+'/h':'horários não disponíveis')+'. Valores recebidos em conta Uber e em espécie continuam separados no controle de movimentações.';
}
function renderGoalForecast55(){
 const el=$('goalForecast'),field=$('goalMonthly');if(!el||!field)return;
 const monthly=Number(field.value)||0;
 el.textContent=monthly>0?'Para juntar R$ 100 mil a partir de zero, guardando '+money(monthly)+'/mês, seriam aproximadamente '+Math.ceil(100000/monthly)+' meses. Essa é uma simulação; não altera suas reservas.':'Informe um valor mensal para simular o prazo da meta de R$ 100 mil. Nenhuma reserva será criada automaticamente.';
}
const goalMonthly55=$('goalMonthly');
if(goalMonthly55){goalMonthly55.value=localStorage.getItem('mf-goal-monthly-55')||'';goalMonthly55.addEventListener('input',()=>{localStorage.setItem('mf-goal-monthly-55',goalMonthly55.value);renderGoalForecast55()});renderGoalForecast55()}
const backup55=$('safeBackup');
if(backup55)backup55.addEventListener('click',()=>{
 if(!user||!loaded)return alert('Entre na conta e aguarde a sincronização antes de exportar.');
 const payload={version:'5.5.0',exportedAt:new Date().toISOString(),records,uberSessions,uberTransfers,uberOpening,uberDraft,uberLedger,cardState,moneyState};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='meu-financeiro-backup-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});

/* v5.5.3 — manual six-account balance reconciliation. Historical records untouched. */
function balanceFields55(){return [...document.querySelectorAll('[data-balance-account]')]}
function balanceCurrent55(k){
 if(k==='uber')return ledgerBalances()?.digital??null;
 if(k==='cash')return ledgerBalances()?.cash??moneyState.balances.cash;
 return moneyState.balances[k];
}
function openBalanceScreen55(){
 if(!user||!loaded)return alert('Aguarde a sincronização antes de conferir saldos.');
 for(const el of balanceFields55()){const n=balanceCurrent55(el.dataset.balanceAccount);el.value=n===null?'':Number(n).toFixed(2)}
 updateBalancePreview55();showTab('saldos');
}
function updateBalancePreview55(){
 const fields=balanceFields55(),total=fields.reduce((sum,el)=>sum+(Number(el.value)||0),0);
 if($('balancePreview'))$('balancePreview').textContent=money(Math.round(total*100)/100);
}
document.addEventListener('click',e=>{if(e.target.closest('[data-tab="saldos"]')){e.preventDefault();openBalanceScreen55()}});
const balanceForm55=$('balanceReconcileForm');
if(balanceForm55){
 balanceForm55.addEventListener('input',updateBalancePreview55);
 balanceForm55.addEventListener('submit',e=>{
 e.preventDefault();
 if(!user||!loaded)return alert('Aguarde a sincronização dos dados.');
 const next={},changes=[];
 for(const el of balanceFields55()){
  const k=el.dataset.balanceAccount,n=Number(el.value),old=balanceCurrent55(k);
  if(!el.value.trim()||!Number.isFinite(n)||Math.abs(n)>1e10)return alert('Informe um valor válido para todas as contas.');
  next[k]=Math.round(n*100)/100;
  if(old===null||Math.abs(next[k]-old)>=.005)changes.push(k+': '+(old===null?'não configurado':money(old))+' → '+money(next[k]));
 }
 if(!changes.length)return alert('Todos os saldos já estão conferidos. Nenhuma alteração necessária.');
 if((next.uber!==null||next.cash!==null)&&!uberLedger.opening){
  return alert('Antes de conciliar Uber e espécie, configure o saldo inicial na aba Uber. Nenhuma alteração foi salva.');
 }
 if(!confirm('Confirmar os saldos reais agora?\n\n'+changes.join('\n')+'\n\nIsso registra ajustes de conferência, não receitas ou despesas.'))return;
 const now=new Date().toISOString(),date=now.slice(0,10);
 for(const k of ['bradesco','bb','inter','caixa','cash']){
  const old=moneyState.balances[k],value=next[k];if(Math.abs(value-old)<.005)continue;
  moneyState.balances[k]=value;
  moneyState.moves.push({id:uid(),type:'adjust',account:k,amount:Math.round((value-old)*100)/100,before:old,after:value,note:'Conferência de saldo — formulário',date:now});
 }
 const b=ledgerBalances();
 if(b&&Math.abs(next.uber-b.digital)>=.005)uberLedger.moves.push({id:'zz-'+uid(),date,type:'adjust_uber',amount:next.uber,note:'Conferência de saldo — formulário'});
 if(b&&Math.abs(next.cash-b.cash)>=.005)uberLedger.moves.push({id:'zz-'+uid(),date,type:'adjust_cash',amount:next.cash,note:'Conferência de saldo — formulário'});
 moneyState.updatedAt=now;save();renderLedger();alert('Saldos atualizados. Confira o extrato e o resumo.');showTab('resumo');
 });
}
