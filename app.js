const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = n => Number(n||0).toLocaleString('en-US',{maximumFractionDigits:0}) + ' FCFA';
const compact = n => Number(n||0)>=1000000000 ? (Number(n)/1000000000).toFixed(2)+'B FCFA' : Number(n||0)>=1000000 ? (Number(n)/1000000).toFixed(2)+'M FCFA' : money(n);
const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
let now=new Date(), currentMonth=now.getMonth(), currentYear=now.getFullYear();
const snapshotMonth='2026-11';
let people=[];
const productDefaults=[];
const categories=['Pesticide','Insecticide','Others'];
let entries=[];
let salesSnapshots=[];
let teamTarget=0;
let teamTargets={};
let adminProfile={name:'Jaykishan Tolani',photo:''};
let user={name:adminProfile.name,role:'employee'};
let rowCounter=0;
let editingEntryId=null;
let annualSalesData=null,showPreviousYear=false;
let reportingMonth='';
let signedInProfile=null,loginMode='employee',pendingLoginMode=null,authStateReady=false,authLoadId=0,persistenceWarning='',saveQueue=Promise.resolve(),lastSyncedState=null,stateUnsubscribe=null,sessionExpiryTimer=null,sessionExpiryAt=0,sessionExpired=false,localEditsPending=false,savesInFlight=0,deferredCloudState=null;
const sessionMaxAgeMs=8*60*60*1000;
function currentState(){return {people,entries,salesSnapshots,teamTarget,teamTargets,annualSalesData}}
function copyState(state){return JSON.parse(JSON.stringify(state))}
function applyCloudState(cloud,render=true){people=cloud.people;entries=cloud.entries;salesSnapshots=cloud.salesSnapshots;teamTargets=cloud.teamTargets||{};teamTarget=cloud.teamTarget||0;annualSalesData=cloud.annualSalesData||null;if(render){renderAll();}}
function save(){if(signedInProfile?.role!=='admin'||!window.tropicaFirebase||!lastSyncedState)return;const state=copyState(currentState());localEditsPending=true;savesInFlight++;const operation=window.tropicaFirebase.saveState(state);operation.then(()=>{savesInFlight=Math.max(0,savesInFlight-1);localEditsPending=false;lastSyncedState=copyState(state);if(deferredCloudState){applyCloudState(deferredCloudState);deferredCloudState=null}}).catch(error=>{console.error('Cloud save failed.',error);savesInFlight=Math.max(0,savesInFlight-1);localEditsPending=false;toast('Could not sync data. Check your connection.');});return operation}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2600)}
function dataYears(){const years=new Set([currentYear,currentYear-1,...(annualSalesData?.years||[]).map(Number),...entries.map(e=>Number(e.date?.slice(0,4))),...salesSnapshots.map(s=>Number(s.month?.slice(0,4)))].filter(Boolean));return [...years].sort((a,b)=>a-b)}
function annualDataYears(){const years=new Set((annualSalesData?.years||[]).map(Number));(annualSalesData?.months||[]).forEach(month=>Object.keys(month.total||{}).forEach(year=>years.add(Number(year))));return years}
function fillYears(sel){const previous=sel.value;sel.innerHTML='';dataYears().forEach(year=>{const option=document.createElement('option');option.value=String(year);option.textContent=String(year);if(previous===String(year))option.selected=true;sel.append(option)});if(!sel.value&&dataYears().length)sel.value=String(dataYears().at(-1));}
function fillMonthNames(sel){const previous=sel.value;sel.innerHTML='';monthNames.forEach((name,index)=>{const option=document.createElement('option');option.value=String(index+1).padStart(2,'0');option.textContent=name;if(previous===option.value)option.selected=true;sel.append(option)});if(!sel.value)sel.value=String(currentMonth+1).padStart(2,'0');}
function fillTargetMonths(sel){const previous=sel.value,years=[...new Set([...dataYears(),currentYear+1])].sort((a,b)=>a-b);sel.innerHTML='';years.forEach(year=>monthNames.forEach((name,index)=>{const option=document.createElement('option');option.value=`${year}-${String(index+1).padStart(2,'0')}`;option.textContent=`${name} ${year}`;if(previous===option.value)option.selected=true;sel.append(option)}));if(!sel.value)sel.value=`${currentYear}-${String(currentMonth+1).padStart(2,'0')}`;}
function fillMonths(sel,includeAll=false){const previous=sel.value;sel.innerHTML='';if(includeAll){const all=document.createElement('option');all.value='all';all.textContent='All months';if(previous==='all')all.selected=true;sel.append(all)};for(let i=0;i<12;i++){const option=document.createElement('option');option.value=`${currentYear}-${String(i+1).padStart(2,'0')}`;option.textContent=`${monthNames[i]} ${currentYear}`;if(previous===option.value)option.selected=true;sel.append(option)};if(!sel.value)sel.value=`${currentYear}-${String(currentMonth+1).padStart(2,'0')}`;}
function selectedOverviewMonth(){return `${$('#overviewYear').value}-${$('#overviewMonth').value}`}
function targetFor(month){return Number(teamTargets[month]??(month===snapshotMonth?teamTarget:0))||0}
function monthEntries(month, publishedOnly=false){return entries.filter(e=>(!month||month==='all'||e.date.startsWith(month))&&(!publishedOnly||e.published))}
function personSalesForMonth(month,publishedOnly=true){const totals=new Map();for(const entry of entries){if((!month||entry.date.startsWith(month))&&(!publishedOnly||entry.published))totals.set(entry.person,(totals.get(entry.person)||0)+Number(entry.value||0));}return totals}
function baselineForPerson(month,person){if(month!==snapshotMonth)return 0;const row=salesSnapshots.find(s=>s.month===month&&s.salespersonId===person.id);return Number(row?.amount??person.sales)||0}
function baselineTotal(month){return month===snapshotMonth?salesSnapshots.filter(s=>s.month===month).reduce((a,s)=>a+(Number(s.amount)||0),0):0}
function totalFor(month,publishedOnly=false){return baselineTotal(month)+monthEntries(month,publishedOnly).reduce((a,e)=>a+Number(e.value),0)}
function datePretty(d){return new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
function activePeople(){return people.filter(p=>p.active!==false)}
function refreshCurrentPeriod(){now=new Date();currentMonth=now.getMonth();currentYear=now.getFullYear()}
function fillSalespeople(){const select=$('#salesperson'),selected=select.value;select.innerHTML=activePeople().map(p=>`<option value="${p.name}">${p.name}</option>`).join('');if(activePeople().some(p=>p.name===selected))select.value=selected;else if(activePeople().length)select.value=activePeople()[0].name;}
async function init(){fillMonthNames($('#overviewMonth'));fillYears($('#overviewYear'));fillTargetMonths($('#targetMonth'));fillMonths($('#reportMonth'),true);fillYears($('#reportYear'));fillYears($('#chartYear'));renderAll();}
function login(role,name,resetPeriod=true){if(resetPeriod){refreshCurrentPeriod();$('#overviewMonth').value=String(currentMonth+1).padStart(2,'0');$('#overviewYear').value=String(currentYear);$('#reportYear').value=String(currentYear);$('#chartYear').value=String(currentYear);}
user={name:(name||adminProfile.name||'User'),role};$('#userName').textContent=name||'User';$('#userRole').textContent=role==='admin'?'Administrator':'Employee';$('#appView').classList.remove('hidden');$('#loginView').classList.add('hidden');$('#appView').classList.toggle('employee-mode',role==='employee');$('.page').forEach?null:null;showPage('overview');renderAll();}
function setLoginStatus(message,busy=false,error=false){const status=$('#loginMessage');status.textContent=message;status.classList.toggle('is-loading',busy);status.classList.toggle('is-error',error);}
function authErrorMessage(error){const messages={'auth/invalid-credential':'The email or password is incorrect.','auth/user-not-found':'No account exists for this email.','auth/wrong-password':'The password is incorrect.','auth/email-already-in-use':'This email is already in use.','auth/weak-password':'Choose a stronger password.','auth/invalid-profile':'This account is not available for this dashboard.','auth/role-mismatch':'This account is not assigned to the selected access level.'};return messages[error?.code]||error?.message||'Something went wrong. Please try again.';}
let authStartupTimeout;
function finishAuthStartup(){clearTimeout(authStartupTimeout);document.documentElement.classList.remove('auth-pending');$('#authLoading')?.classList.add('hidden')}
function clearSessionTimer(){clearTimeout(sessionExpiryTimer);sessionExpiryTimer=null;sessionExpiryAt=0}
async function expireSession(){if(!signedInProfile)return;clearSessionTimer();sessionExpired=true;try{await window.tropicaFirebase.signOut()}catch(error){console.error('Could not complete automatic sign-out.',error)}}
function scheduleSessionExpiry(authTime){const signedInAt=Date.parse(authTime);if(!Number.isFinite(signedInAt))return;sessionExpiryAt=signedInAt+sessionMaxAgeMs;if(sessionExpiryAt<=Date.now()){expireSession();return;}clearSessionTimer();sessionExpiryTimer=setTimeout(()=>expireSession(),Math.max(0,sessionExpiryAt-Date.now()))}
function checkSessionExpiry(){if(signedInProfile&&sessionExpiryAt&&Date.now()>=sessionExpiryAt)expireSession()}
window.addEventListener('focus',checkSessionExpiry);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkSessionExpiry()});
async function restoreFirebaseSession(authUser){
  const loadId=++authLoadId;
  if(!authUser){
    const hadSession=!!signedInProfile;
    clearSessionTimer();
    stateUnsubscribe?.();stateUnsubscribe=null;
    signedInProfile=null;
    lastSyncedState=null;
    localEditsPending=false;
    deferredCloudState=null;
    try{localStorage.removeItem('tropica.auth-session')}catch(error){console.warn('Could not clear the local session hint.',error)}
    if(authStateReady&&hadSession){$('#appView').classList.add('hidden');$('#appView').classList.remove('employee-mode');$('#loginView').classList.remove('hidden')}
    authStateReady=true;
    if(!hadSession)setLoginStatus(sessionExpired?'Your session expired after 8 hours. Please sign in again.':persistenceWarning||'Use the account and password assigned to you.',false,!!persistenceWarning);
    sessionExpired=false;
    finishAuthStartup();
    return;
  }
  authStateReady=true;
  setLoginStatus('Signing you in…',true);
  const expectedRole=pendingLoginMode;
  pendingLoginMode=null;
  try{
    const token=await authUser.getIdTokenResult();
    const signedInAt=Date.parse(token.authTime);
    if(Number.isFinite(signedInAt)&&Date.now()-signedInAt>=sessionMaxAgeMs){sessionExpired=true;await window.tropicaFirebase.signOut();setLoginStatus('Your session expired after 8 hours. Please sign in again.',false,true);finishAuthStartup();return;}
    const profile=await window.tropicaFirebase.loadProfile(authUser.uid);
    if(!profile||profile.active!==true||!['admin','employee'].includes(profile.role))throw Object.assign(new Error('This account is not assigned an active dashboard role. Ask the administrator to verify access.'),{code:'auth/invalid-profile'});
    if(expectedRole&&profile.role!==expectedRole)throw Object.assign(new Error(`This account is not set up for ${expectedRole} access.`),{code:'auth/role-mismatch'});
    signedInProfile={...profile,uid:authUser.uid};
    scheduleSessionExpiry(token.authTime);
    adminProfile={...adminProfile,name:profile.role==='admin'?(profile.displayName||'Jaykishan Tolani'):adminProfile.name,photo:profile.photo||adminProfile.photo};
    stateUnsubscribe?.();
    let firstState=true;
    const subscription=window.tropicaFirebase.subscribeState(cloud=>{
      if(loadId!==authLoadId||window.tropicaFirebase.auth.currentUser?.uid!==authUser.uid)return;
      if(firstState){
        firstState=false;
        applyCloudState(cloud,false);
        try{localStorage.setItem('tropica.auth-session','1')}catch(error){console.warn('Could not store the local session hint.',error)}
        login(profile.role,profile.displayName||profile.name||authUser.email?.split('@')[0]);
        $('#loginPassword').value='';
        finishAuthStartup();
      }else if(savesInFlight||localEditsPending)deferredCloudState=cloud;
      else applyCloudState(cloud);
    },error=>{
      console.error(error);
      if(firstState)return;
      toast('Live data refresh failed. Check your connection.');
    });
    stateUnsubscribe=subscription.unsubscribe;
    await subscription.ready;
    if(loadId!==authLoadId)return;
  }catch(error){
    if(loadId!==authLoadId)return;
    console.error(error);
    stateUnsubscribe?.();stateUnsubscribe=null;
    if(error.code==='auth/invalid-profile'||error.code==='auth/role-mismatch'){try{await window.tropicaFirebase.signOut()}catch(signOutError){console.error('Could not sign out an account without dashboard access.',signOutError)}}
    const message=authErrorMessage(error);
    toast(message);
    setLoginStatus(message,false,true);
    finishAuthStartup();
  }
}
async function signInWithFirebase(){const email=$('#loginEmail').value.trim(),password=$('#loginPassword').value;pendingLoginMode=loginMode;setLoginStatus('Signing in…',true);try{await window.tropicaFirebase.signIn(email,password)}catch(error){console.error(error);const message=authErrorMessage(error);toast(message);setLoginStatus(message,false,true)}}
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();signInWithFirebase()});
$('#loginPassword').addEventListener('invalid',e=>{if(!e.currentTarget.value)e.currentTarget.setCustomValidity('Please enter your Password')});
$('#loginPassword').addEventListener('input',e=>e.currentTarget.setCustomValidity(''));
function setLoginMode(mode){loginMode=mode;const isAdmin=mode==='admin';$('#employeeLoginSubmit').innerHTML=isAdmin?'Continue as admin <span>→</span>':'Login as employee <span>→</span>';$($('#adminDemo')).textContent=isAdmin?'Login as employee':'Login as admin';}
$('#adminDemo').addEventListener('click',()=>setLoginMode(loginMode==='admin'?'employee':'admin'));
$('#togglePassword').addEventListener('click',()=>{let p=$('#loginPassword');p.type=p.type==='password'?'text':'password';$('#togglePassword').textContent=p.type==='password'?'Show':'Hide'});
$('#logoutBtn').addEventListener('click',async()=>{await window.tropicaFirebase.signOut();$('#appView').classList.add('hidden');$('#appView').classList.remove('employee-mode');$('#loginView').classList.remove('hidden')});
function showPage(page){$$('.page').forEach(p=>p.classList.remove('active'));$('#'+page+'Page').classList.add('active');$$('.nav-item[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));}
$$('.nav-item[data-page]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
$('#mobileMenu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('#viewEmployeeBoard').addEventListener('click',()=>login('employee',activePeople()[0]?.name,false));
function productList(){return [...new Set([...entries.map(e=>e.product),...$$('.row-product').map(i=>i.value)].filter(Boolean))]}
function refreshProductOptions(typed=''){let list=$('#productOptions');if(!list)return;let names=productList();if(typed.trim())names=[typed.trim(),...names.filter(n=>n.toLowerCase()!==typed.trim().toLowerCase())];list.innerHTML=names.map(name=>`<option value="${name}"></option>`).join('');}
function addProductRow(data={}){rowCounter++;refreshProductOptions();let tr=document.createElement('tr');tr.innerHTML=`<td><input class="product-input row-product" list="productOptions" placeholder="Product name" value="${data.product||''}"></td><td><select class="row-category"><option value="Pesticide" ${data.category==='Pesticide'?'selected':''}>Pesticide</option><option value="Insecticide" ${data.category==='Insecticide'?'selected':''}>Insecticide</option><option value="Others" ${data.category==='Others'?'selected':''}>Others</option></select></td><td><input class="row-qty" type="number" min="0" step="1" value="${data.quantity||1}"></td><td><input class="row-value" type="number" min="0" step="1" value="${data.value||0}"></td><td><button type="button" class="remove-row">×</button></td>`;tr.querySelector('.remove-row').addEventListener('click',()=>tr.remove());$('#salesRows').append(tr);updateEntryTotal();}
const dl=document.createElement('datalist');dl.id='productOptions';document.body.append(dl);
$('#addRow').addEventListener('click',()=>addProductRow());function updateEntryTotal(){let sum=$$('.row-value').reduce((a,i)=>a+Number(i.value||0),0);$('#entryTotal').textContent=money(sum)}
$('#salesForm').addEventListener('submit',e=>{e.preventDefault();let rows=$$('#salesRows tr'),person=$('#salesperson').value,date=$('#saleDate').value,ref=$('#saleReference').value;if(editingEntryId===null){const newEntry={id:Date.now()+Math.random(),date,person,reference:ref,product:'',value:0,quantity:1,category:'Pesticide',published:false};rows.forEach(r=>{const product=r.querySelector('.row-product').value.trim();const category=r.querySelector('.row-category').value;const qty=Number(r.querySelector('.row-qty').value||0);const value=Number(r.querySelector('.row-value').value||0);if(product){entries.push({...newEntry,id:Date.now()+Math.random(),product,category,quantity:qty,value,person,date,reference:ref,published:false});}});if(!entries.length)toast('Add at least one valid product row before saving.');save();renderAll();}else{const entry=entries.find(e=>String(e.id)===String(editingEntryId));if(entry){entry.person=person;entry.date=date;entry.reference=ref;entry.product='';entry.value=0;entry.quantity=0;entry.category='Pesticide';rows.forEach(r=>{const product=r.querySelector('.row-product').value.trim();const category=r.querySelector('.row-category').value;const qty=Number(r.querySelector('.row-qty').value||0);const value=Number(r.querySelector('.row-value').value||0);if(product){entry.product = entry.product ? entry.product + ', ' + product : product;entry.value += value;entry.quantity += qty;entry.category = category;}});if(!entry.product){toast('Add at least one product row before saving edits.');return;}}save();renderAll();}$('#salesForm').reset();editingEntryId=null;$('#clearEntry').click();});
$('#clearEntry').addEventListener('click',()=>setTimeout(()=>{editingEntryId=null;$('#salesForm button[type="submit"]').innerHTML='Save sales entry <span>→</span>';if(!$('#salesRows').children.length)$('#salesRows').innerHTML='';},0));
$('#targetAmount').addEventListener('input',()=>$('#targetPreview').textContent=money($('#targetAmount').value));
$('#targetMonth').addEventListener('change',()=>{$('#targetAmount').value=targetFor($('#targetMonth').value);$('#targetPreview').textContent=money($('#targetAmount').value)});
$('#saveTarget').addEventListener('click',()=>{const month=$('#targetMonth').value,value=Number($('#targetAmount').value)||0;teamTargets[month]=value;if(month===snapshotMonth)teamTarget=value;save();renderAll();toast('Team target updated.');});
$('#publishBtn').addEventListener('click',()=>{let count=entries.filter(e=>!e.published).length;entries.forEach(e=>e.published=true);save();renderAll();$('#publishStatus').textContent='Last published: Demo data';toast(`${count} changes published.`);});
function updateReportingPeriod(){reportingMonth=selectedOverviewMonth();renderOverview();renderEmployee()}
$('#overviewMonth').addEventListener('change',updateReportingPeriod);$('#overviewYear').addEventListener('change',updateReportingPeriod);
$('#entrySearch').addEventListener('input',renderEntry);$('#entryDateFilter').addEventListener('change',renderEntry);
function renderAll(){fillMonthNames($('#overviewMonth'));fillYears($('#overviewYear'));fillTargetMonths($('#targetMonth'));fillMonths($('#reportMonth'),true);fillYears($('#reportYear'));fillYears($('#chartYear'));fillSalespeople();renderOverview();renderEntry();renderReports();renderEmployee();renderTeam();}
function renderOverview(){const m=selectedOverviewMonth();reportingMonth=m;const total=totalFor(m,true),monthlyTarget=targetFor(m),pct=monthlyTarget?Math.min(100,total/monthlyTarget*100):0;$('#totalSales').textContent=money(total);$('#teamTarget').textContent=money(monthlyTarget);$('#targetProgress').textContent=pct.toFixed(1)+'%';$('#ringPercent').textContent=`${pct.toFixed(1)}%`;$('#ringAchieved').textContent=money(total);$('#ringRemaining').textContent=money(Math.max(0,monthlyTarget-total));$('#teamProgressBar').style.width=`${Math.min(100,pct)}%`;$('#targetCaption').textContent=`${pct.toFixed(1)}% target`;document.querySelector('#overviewTargetMonth').textContent=monthNames[Number(m.slice(5,7))-1]+' '+m.slice(0,4);}
function chartMonthIndex(value){const numeric=Number(value);if(numeric>=1&&numeric<=12)return numeric-1;return monthNames.findIndex(name=>name.toLowerCase().startsWith(String(value||'').slice(0,3).toLowerCase()));}
function chartSeries(year){const values=Array(12).fill(null);const rows=(annualSalesData?.months||[]).filter(row=>Number(Object.keys(row.total||{})[0]||year)===year);if(rows.length){rows.forEach(row=>{const idx=chartMonthIndex(row.month||Object.keys(row.total||{})[0]);if(!Number.isNaN(idx)&&idx>=0)values[idx]=Number(row.total?.[String(year)]||0);});}return values}
function chartMoney(value,currency='FCFA',compactValue=false){if(currency==='FCFA')return compactValue?compact(value):money(Math.round(value));return String(value)}
function drawChart(animate=false){const selected=Number($('#chartYear').value||currentYear);const selectedData=chartSeries(selected);const priorYear=selected-1;const priorData=chartSeries(priorYear);const actualPath=$('#actualPath');const comparisonPath=$('#comparisonPath');const areaPath=$('#areaPath');let max=Math.max(...selectedData.filter(v=>Number.isFinite(v)),...priorData.filter(v=>Number.isFinite(v)),1);const points=selectedData.map((val,idx)=>{const x=30+idx*52;const y=190-(val/max)*150;return {x,y,val};});const coords=points.map(({x,y})=>`${x},${y}`).join(' ');actualPath.setAttribute('d',`M ${points.map(({x,y})=>`${x} ${y}`).join(' L ')}`);areaPath.setAttribute('d',`M ${points[0].x} 190 L ${points.map(({x,y})=>`${x} ${y}`).join(' L ')} L ${points.at(-1).x} 190 Z`);comparisonPath.setAttribute('d',`M ${priorData.map((val,idx)=>`${30+idx*52} ${190-(Number(val||0)/max)*150}`).join(' L ')}`);}
function renderEntry(){if(!$('#recentEntries'))return;fillSalespeople();let drafts=entries.filter(e=>!e.published);$('#entryCount').textContent=entries.length+' entries';$('#unpublishedCount').textContent=drafts.length;$('#recentEntries').innerHTML=entries.slice().reverse().map(entry=>`<tr><td>${datePretty(entry.date)}</td><td>${entry.person}</td><td>${entry.product}</td><td>${money(entry.value)}</td><td>${entry.published?'Published':'Draft'}</td><td><button class="text-btn" data-edit="${entry.id}">Edit</button></td></tr>`).join('');$$('[data-edit]').forEach(btn=>btn.addEventListener('click',()=>editEntry(btn.dataset.edit)));}
function renderReports(){let year=Number($('#reportYear').value||currentYear),rows=[];for(let i=0;i<12;i++){if(year===currentYear&&i>currentMonth)continue;let m=`${year}-${String(i+1).padStart(2,'0')}`;rows.push({month:m,total:totalFor(m,true),target:targetFor(m),workers:activePeople().length});}$('#reportRows').innerHTML=rows.map(row=>`<tr><td>${monthNames[Number(row.month.slice(5,7))-1]} ${row.month.slice(0,4)}</td><td>${money(row.total)}</td><td>${money(row.target)}</td><td>${row.target?((row.total/row.target)*100).toFixed(1)+'%':'0%'}</td><td>${row.workers}</td><td>${row.target?((row.total/row.target)*100).toFixed(1)+'% of target':'0%'}</td><td><button class="text-btn" data-month="${row.month}">Download</button></td></tr>`).join('');$$('[data-month]').forEach(btn=>btn.addEventListener('click',()=>downloadXlsx(btn.dataset.month)));}
function exportXLSX(month){downloadXlsx(month)}
$('#downloadAll').addEventListener('click',()=>downloadXlsx($('#reportMonth').value==='all'?null:$('#reportMonth').value));
$('#downloadDataBackup').addEventListener('click',downloadDataBackup);
function downloadDataBackup(){const data={schemaVersion:1,description:'Company Name business data backup exported from Firebase.',currency:'XOF',businessTimezone:'Africa/Abidjan',salespeople:people,salesEntries:entries,salesSnapshots,monthlyTargets:teamTargets};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='company-name-business-data-backup.json';a.click();URL.revokeObjectURL(url);}
$('#importDataBtn').addEventListener('click',()=>$('#importDataFile').click());$('#importDataFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.salespeople){people=data.salespeople;}if(data.salesEntries){entries=data.salesEntries;}if(data.salesSnapshots){salesSnapshots=data.salesSnapshots;}if(data.monthlyTargets){teamTargets=data.monthlyTargets;}save();renderAll();toast('Data imported successfully.');}catch(error){console.error(error);toast('Import failed. Please check the JSON format.');}});
function xmlEsc(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')}
function colName(n){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s}
function sheetXml(rows){const body=rows.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>{const ref=`${colName(ci)}${ri+1}`;return typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t>${xmlEsc(v??'')}</t></is></c>`}).join('')}</row>`).join('');return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`}
function downloadXlsx(month){const targetMonth=month||'all';const rows=[['Date','Salesperson','Product','Category','Quantity','Sales value','Reference','Published']];entries.filter(e=>targetMonth==='all'||e.date.startsWith(targetMonth)).forEach(e=>rows.push([e.date,e.person,e.product,e.category,e.quantity,e.value,e.reference,e.published?'Yes':'No']));const wb=`<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><Worksheet><table>${rows.map(r=>`<row>${r.map((v,i)=>`<c r="${colName(i)}${rows.indexOf(r)+1}" t="inlineStr"><is><t>${xmlEsc(v)}</t></is></c>`).join('')}</row>`).join('')}</table></Worksheet></Workbook>`;const blob=new Blob([wb],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`company-name-sales-${targetMonth==='all'?'all-months':targetMonth}.xlsx`;a.click();URL.revokeObjectURL(url);}
$('#reportYear').addEventListener('change',renderReports);$('#chartYear').addEventListener('change',()=>{showPreviousYear=false;drawChart()});
function employeeFmt(n){return new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(Number(n)||0)}
function employeeTrophy(rank){const palettes={1:['#fff1b4','#d6a949','#6c4616'],2:['#f3ffff','#aebdc4','#435461'],3:['#ffdac0','#bb8058','#57301c']};const c=palettes[rank]||palettes[1];return `<div class="employee-trophy" style="--trophy-gold:${c[0]};--trophy-silver:${c[1]};--trophy-base:${c[2]};"></div>`;}
function renderEmployee(){const m=reportingMonth||selectedOverviewMonth();const published=monthEntries(m,true);const ranked=activePeople().map(person=>{const personEntries=published.filter(e=>e.person===person.name);const actual=baselineForPerson(m,person)+personEntries.reduce((sum,e)=>sum+Number(e.value||0),0);return {...person,actual,entries:personEntries.length,closed:personEntries.length,awaiting:0,open:0};}).sort((a,b)=>b.actual-a.actual);const totalSales=baselineTotal(m)+published.reduce((sum,e)=>sum+Number(e.value||0),0), target=targetFor(m), achieved=target?totalSales/target*100:0, remaining=Math.max(0,target-totalSales);$('#employeeDateRange').textContent=`${monthNames[Number(m.slice(5,7))-1]} ${m.slice(0,4)}`;$('#employeePodium').innerHTML=ranked.slice(0,3).map((p,i)=>`<div class="employee-winner ${['first','second','third'][i]}">${employeeTrophy(i+1)}<div class="employee-winner-meta"><strong>${p.name}</strong><span>${money(p.actual)}</span></div></div>`).join('');$('#employeeTeamPercent').textContent=achieved.toFixed(1);$('#employeeTargetGauge').setAttribute('stroke-dasharray',`${Math.min(100,achieved).toFixed(2)} 100`);$('#employeeTeamTarget').textContent=employeeFmt(target);$('#employeeTeamAchieved').innerHTML=`Sales achieved: <strong>${employeeFmt(totalSales)} / ${employeeFmt(target)} FCFA</strong>`;$('#employeeTargetRemaining').textContent=`${employeeFmt(remaining)} FCFA`;$('#employeeTargetLeftPercent').textContent=`${target?(remaining/target*100).toFixed(1):'0.0'}%`;$('#employeeTargetQuote').textContent=achieved>=100?'Target achieved! We super achieved our target! 🏆':achieved>=75?'Just a bit more to go — you’ve got this!':achieved>=50?'We’re on fire!': 'Let’s get moving!';const sortKey=$('#employeeSort')?.value||'sales';const sorted=[...ranked].sort((a,b)=>sortKey==='sales'?b.actual-a.actual:sortKey==='closed'?b.closed-a.closed||b.actual-a.actual:b.entries-a.entries);$('#employeeLeaderboardRows').innerHTML=sorted.map((p,i)=>`<tr><td><span class="employee-rank-pill">${String(i+1).padStart(2,'0')}</span></td><td class="employee-person">${p.name}</td><td>${p.entries}</td><td>${p.closed}</td><td>${money(p.actual)}</td></tr>`).join('');}
$('#employeeSort').addEventListener('change',renderEmployee);
function editEntry(id){const entry=entries.find(e=>String(e.id)===String(id));if(!entry)return;editingEntryId=entry.id;showPage('entry');$('#saleDate').value=entry.date;$('#salesperson').value=entry.person;$('#saleReference').value=entry.reference||'';$('#salesRows').innerHTML='';addProductRow({product:entry.product,category:entry.category||'Pesticide',quantity:entry.quantity||1,value:entry.value||0});}
function renderTeam(){const rows=$('#teamRows');if(!rows)return;rows.innerHTML=[...people].map(p=>`<tr><td><b>${p.name}</b></td><td>${p.region||'—'}</td><td>${money(baselineForPerson(snapshotMonth,p))}</td><td>${p.active===false?'Inactive':'Active'}</td><td><button class="text-btn" data-person="${p.name}">Remove</button></td></tr>`).join('');$$('[data-person]').forEach(btn=>btn.addEventListener('click',()=>{const name=btn.dataset.person;people=people.filter(p=>p.name!==name);save();renderTeam();toast(`${name} removed from the team.`);}));}
$('#addPersonForm').addEventListener('submit',e=>{e.preventDefault();const name=$('#newPersonName').value.trim();if(!name)return;const region=$('#newPersonRegion').value.trim();if(people.some(p=>p.name.toLowerCase()===name.toLowerCase())){toast('This salesperson already exists.');return;}people.push({id:String(Date.now()),name,region,active:true});save();renderTeam();$('#addPersonForm').reset();toast(`${name} added to the team.`);});
function setAvatar(name,photo){const node=$('#userAvatar');node.textContent='';if(photo){const img=document.createElement('img');img.src=photo;img.alt='';node.append(img)}else node.textContent=(name||'U').charAt(0).toUpperCase();}
function applyAdminProfile(fillName=true){if(!adminProfile.name)adminProfile.name='Jaykishan Tolani';if(user.role==='admin'){$('#userName').textContent=adminProfile.name;setAvatar(adminProfile.name,adminProfile.photo);}}
$('#adminProfileOpen').addEventListener('click',()=>{applyAdminProfile();$('#adminProfileDialog').showModal()});$('#adminProfileClose').addEventListener('click',()=>$('#adminProfileDialog').close());$('#adminProfilePhoto').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');const size=180;canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');ctx.fillStyle='#ecf2ef';ctx.fillRect(0,0,size,size);ctx.drawImage(img,0,0,size,size);adminProfile.photo=canvas.toDataURL('image/png');$('#adminProfilePhotoPreview').src=adminProfile.photo;$('#adminProfilePhotoPreview').classList.remove('hidden');};img.src=reader.result;};reader.readAsDataURL(file);});
$('#adminProfileForm').addEventListener('submit',async e=>{e.preventDefault();adminProfile.name=$('#adminProfileName').value.trim()||'Jaykishan Tolani';try{await window.tropicaFirebase.saveAdminProfile(adminProfile);toast('Profile updated.');$('#adminProfileDialog').close();applyAdminProfile();}catch(error){console.error(error);toast('Could not save admin profile.');}});
window.addEventListener('DOMContentLoaded', async () => {
  if(document.documentElement.classList.contains('auth-pending')){authStartupTimeout=setTimeout(()=>{finishAuthStartup();setLoginStatus('Session restoration is taking longer than usual. You can sign in below.',false,true);},10000);}
  try{
    await init();
    const firebase = window.tropicaFirebase;
    if (!firebase) throw new Error('Firebase could not be initialized. Check your connection and reload the page.');
    const persistenceError = await firebase.ready;
    if (persistenceError) {console.warn('Persistent sign-in is unavailable in this browser.', persistenceError);persistenceWarning='This browser could not save your sign-in. You may need to sign in again after refreshing.';}
    firebase.onAuthStateChanged(restoreFirebaseSession, error => {console.error(error);authStateReady=true;const message=authErrorMessage(error);setLoginStatus(message,false,true);finishAuthStartup();toast(message);});
  } catch (error) {console.error(error);authStateReady=true;const message=authErrorMessage(error);setLoginStatus(message,false,true);finishAuthStartup();toast(message);}
});
