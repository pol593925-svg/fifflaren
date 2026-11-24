(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const node = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; };
  const labels = {requested:'Ожидает назначения',assigned:'Ожидает выдачи',active:'Выдан',return_pending:'Возврат на подтверждении',closed:'Возвращён',rejected:'Отклонён'};
  const actionLabels = {assign:'Назначить сотрудника',reject:'Отклонить заявку',confirm_issue:'Подтверждаю выдачу',decline_issue:'Не могу выдать',request_return:'Я вернул баллы',confirm_return:'Подтверждаю получение',deny_return:'Возврат не получен'};
  let session = null, epoch = 0, sequence = 0, page = 0, rows = [], selected = null, selectedSequence = 0, requestId = null, signature = '', pending = false;
  let initialized = false;
  const dateLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('.') : '—';
  function today() { const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-'); }
  async function api(path, init = {}) {
    const cfg = session;
    if (!cfg?.token) throw Error('Войди в приложение заново.');
    const response = await fetch(cfg.server + path, {...init,headers:{Authorization:'Bearer '+cfg.token,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});
    let data; try { data = await response.json(); } catch { throw Error('Учёт долгов станет доступен после обновления сервера.'); }
    if (cfg !== session) throw Error('Аккаунт изменился. Открой раздел заново.');
    if (!response.ok || !data.success) { const error = Error(data.message || 'Не удалось выполнить запрос.'); error.status = response.status; throw error; }
    return data;
  }
  function modal(id,title) {
    const el=node('dialog','','hub-work-dialog desk-dialog loans-dialog');el.id=id;
    const heading=node('h2',title);heading.id=id+'Title';el.setAttribute('aria-labelledby',heading.id);
    const close=node('button','×','hub-work-close');close.type='button';close.setAttribute('aria-label','Закрыть');close.onclick=()=>el.close();el.append(close,heading);document.body.append(el);return el;
  }
  function field(form,id,label,type='text') {
    const wrap=node('label',label,'loans-field'),input=node(type==='textarea'?'textarea':'input');input.id=id;if(type!=='textarea')input.type=type;wrap.htmlFor=id;wrap.append(input);form.append(wrap);return input;
  }
  function init() {
    if(initialized||!document.querySelector('.terra-shift-actions')||!window.HubWorkspace)return;initialized=true;
    const pane=node('section','','content desk-loans');pane.id='tab-loans';pane.style.display='none';
    const header=node('header','','loans-heading'),text=node('div');text.append(node('small','ВНУТРЕННИЕ БАЛЛЫ','desk-kicker'),node('h2','Кто у кого'),node('p','Общий список долгов. Выдачу и возврат подтверждают участники.'));
    const create=node('button','Взять в долг трюфель','desk-primary');create.type='button';create.id='loansCreate';header.append(text,create);
    const tools=node('div','','loans-toolbar'),filter=node('select');filter.id='loansFilter';filter.setAttribute('aria-label','Фильтр долгов');
    for(const [value,label] of Object.entries({all:'Все заявки',requested:'Новые',assigned:'Ожидают выдачи',active:'Текущие долги',return_pending:'Проверить возврат',overdue:'Просроченные',closed:'Закрытые',rejected:'Отклонённые'}))filter.add(new Option(label,value));
    const refresh=node('button','Обновить','template-btn');refresh.type='button';refresh.id='loansRefresh';
    const status=node('p','','desk-form-status');status.id='loansStatus';status.setAttribute('role','status');
    const list=node('div','','loans-list');list.id='loansList';
    const more=node('button','Показать ещё','template-btn');more.type='button';more.id='loansMore';more.hidden=true;
    tools.append(filter,refresh);pane.append(header,tools,status,list,more);document.body.append(pane);
    window.HubWorkspace.register({id:'loans',label:'Долги',element:pane,onOpen:()=>load()});
    filter.onchange=()=>load();refresh.onclick=()=>load();more.onclick=()=>load(true);
    const shiftButton=node('button','Взять в долг трюфель','terra-action desk-loan-action');shiftButton.id='shiftLoanButton';shiftButton.type='button';document.querySelector('.terra-shift-actions').append(shiftButton);
    const formDialog=modal('loanRequestDialog','Взять в долг трюфель');formDialog.append(node('p','Укажи количество внутренних баллов и срок. Fifflaren назначит сотрудника, который подтвердит выдачу.','desk-dialog-copy'));
    const form=node('form');form.id='loanRequestForm';
    const nick=field(form,'loanNickname','Твой ник');nick.maxLength=100;nick.required=true;nick.autocomplete='off';
    const quantity=field(form,'loanQuantity','Количество трюфелей','number');quantity.min='1';quantity.max='1000000';quantity.step='1';quantity.required=true;
    const dates=node('div','','loans-dates');form.append(dates);
    const from=field(dates,'loanStartDate','Дата выдачи','date'),due=field(dates,'loanDueDate','Вернуть до','date');from.required=due.required=true;
    const terms=field(form,'loanTerms','Что предлагаешь при просрочке (необязательно)','textarea');terms.maxLength=1500;terms.rows=3;terms.placeholder='Условия, которые согласуете с сотрудником';
    const agreement=node('label','','loans-agreement'),commit=node('input'),agreementText=node('span','Обязуюсь вернуть баллы в указанный срок.');commit.type='checkbox';commit.id='loanCommitment';commit.required=true;agreement.append(commit,agreementText);form.append(agreement);
    form.append(node('p','Здесь фиксируются договорённости. Баланс и условия просрочки автоматически не применяются.','loans-note'));
    const formStatus=node('p','','desk-form-status');formStatus.id='loanRequestStatus';formStatus.setAttribute('role','status');const submit=node('button','Отправить заявку','desk-primary');submit.id='loanRequestSubmit';submit.type='submit';form.append(formStatus,submit);formDialog.append(form);
    let opener=create;
    function openForm(button) {opener=button;if(!nick.value)nick.value=session?.username||'';if(!from.value){from.value=today();const end=new Date(from.value+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+7);due.value=end.toISOString().slice(0,10);}from.min=today();due.min=from.value;formStatus.textContent='';if(!formDialog.open)formDialog.showModal();quantity.focus();}
    from.onchange=()=>{due.min=from.value;};create.onclick=()=>openForm(create);shiftButton.onclick=()=>openForm(shiftButton);formDialog.addEventListener('close',()=>opener.focus({preventScroll:true}));
    form.onsubmit=async event=>{
      event.preventDefault();if(pending||!form.reportValidity())return;
      if(nick.value.trim().toLowerCase()!==session?.username.toLowerCase()){formStatus.textContent='Укажи ник своего аккаунта: '+(session?.username||'');nick.focus();return;}
      if(due.value<from.value){formStatus.textContent='Дата возврата не может быть раньше выдачи.';due.focus();return;}
      const payload={nickname:nick.value.trim(),quantity:Number(quantity.value),startDate:from.value,dueDate:due.value,terms:terms.value.trim(),commitment:commit.checked};
      const next=JSON.stringify(payload);if(next!==signature||!requestId){signature=next;requestId=crypto.randomUUID();}payload.requestId=requestId;
      pending=true;const account=epoch;submit.disabled=true;for(const input of form.querySelectorAll('input,textarea'))input.disabled=true;formStatus.textContent='Отправляем заявку…';
      try {await api('/api/loans',{method:'POST',body:JSON.stringify(payload)});if(account!==epoch)return;requestId=null;signature='';form.reset();nick.value=session.username;formDialog.close();window.HubWorkspace.open('loans');}
      catch(error){if(account===epoch)formStatus.textContent=error.message+' Данные сохранены в форме.';}
      finally{if(account===epoch){pending=false;submit.disabled=false;for(const input of form.querySelectorAll('input,textarea'))input.disabled=false;}}
    };
    const details=modal('loanDetailDialog','Заявка на трюфели');const detailBody=node('div');detailBody.id='loanDetailBody';details.append(detailBody);
  }
  function statusText(row){return row.overdue&&['active','return_pending'].includes(row.status)?'Просрочен · '+labels[row.status]:(labels[row.status]||row.status);}
  function render() {
    const list=$('loansList');list.replaceChildren();
    if(!rows.length){const empty=node('div','','loans-empty');empty.append(node('h3','Здесь появятся договорённости'),node('p','Новая заявка сначала попадёт к Fifflaren, затем — к назначенному сотруднику.'));list.append(empty);return;}
    for(const row of rows){
      const card=node('article','','loans-row');card.dataset.loanId=row.id;
      const people=node('div','','loans-people');people.append(node('strong',row.borrower+' ← '+(row.lender||'Сотрудник не назначен')),node('small','Заёмщик ← кто выдаёт'));
      const amount=node('div','','loans-amount');amount.append(node('strong',new Intl.NumberFormat('ru').format(row.quantity)),node('small','трюфелей'));
      const date=node('div','','loans-due');date.append(node('strong','до '+dateLabel(row.dueDate)),node('small','с '+dateLabel(row.startDate)));
      const state=node('span',statusText(row),'loans-badge loans-'+(row.overdue?'overdue':row.status));
      const open=node('button',row.actions?.length?'Открыть заявку':'Подробнее','template-btn');open.type='button';open.onclick=()=>show(row.id);
      card.append(people,amount,date,state,open);list.append(card);
    }
  }
  async function load(append=false) {
    if(!session||!initialized)return;const run=++sequence,account=epoch,next=append?page+1:0;const status=$('loansStatus');status.textContent='Загружаем договорённости…';$('loansMore').disabled=true;
    try {const data=await api('/api/loans?page='+next+'&status='+encodeURIComponent($('loansFilter').value));if(run!==sequence||account!==epoch)return;page=next;rows=append?rows.concat(data.loans):data.loans;render();$('loansMore').hidden=!data.hasMore;status.textContent='Заявок: '+data.total+' · список виден всем сотрудникам';}
    catch(error){if(run===sequence&&account===epoch)status.textContent=error.message;}
    finally{if(run===sequence&&account===epoch)$('loansMore').disabled=false;}
  }
  async function show(id) {
    const account=epoch,run=++selectedSequence;const dialog=$('loanDetailDialog'),body=$('loanDetailBody');selected=id;body.replaceChildren(node('p','Загружаем заявку…'));if(!dialog.open)dialog.showModal();
    try{const data=await api('/api/loans/'+encodeURIComponent(id));if(account!==epoch||run!==selectedSequence)return;await renderDetail(data.loan,body,account,run);}
    catch(error){if(account===epoch&&run===selectedSequence)body.replaceChildren(node('p',error.message));}
  }
  async function renderDetail(row,body,account,run) {
    body.replaceChildren();
    const summary=node('div','','loans-detail-summary');summary.append(node('strong',row.borrower+' ← '+(row.lender||'Ожидает назначения')),node('b',row.quantity+' трюфелей'),node('p',dateLabel(row.startDate)+' — '+dateLabel(row.dueDate)),node('span',statusText(row),'loans-badge loans-'+(row.overdue?'overdue':row.status)));body.append(summary);
    if('terms' in row){const terms=node('section','','loans-terms');terms.append(node('h3','Условия заявки'),node('p',row.terms||'Вернуть количество баллов в указанный срок. Дополнительные условия не указаны.'));body.append(terms);}
    const actions=row.actions||[],form=node('form','','loans-actions'),message=node('p','','desk-form-status');message.setAttribute('role','status');message.id='loanActionStatus';
    let lender=null,reason=null;
    if(actions.includes('assign')){const label=node('label','Кто выдаёт трюфели','loans-field');lender=node('select');lender.id='loanLender';lender.add(new Option('Выбрать сотрудника',''));label.append(lender);form.append(label);try{const data=await api('/api/loans/employees');if(account!==epoch||run!==selectedSequence)return;for(const entry of data.users||[]){const name=typeof entry==='string'?entry:entry.username;if(name&&name.toLowerCase()!==row.borrower.toLowerCase())lender.add(new Option(name,name));}}catch(error){message.textContent=error.message;}}
    if(actions.some(a=>['reject','decline_issue','deny_return'].includes(a))){reason=field(form,'loanActionReason','Причина, если отклоняешь','textarea');reason.maxLength=500;reason.rows=2;}
    const buttons=node('div','','loans-action-buttons');
    for(const action of actions){if(!actionLabels[action])continue;const button=node('button',actionLabels[action],['reject','decline_issue','deny_return'].includes(action)?'template-btn':'desk-primary');button.type='button';button.dataset.loanAction=action;buttons.append(button);
      button.onclick=async()=>{
        if(action==='assign'&&!lender?.value){message.textContent='Выбери сотрудника.';lender?.focus();return;}
        if(['reject','decline_issue','deny_return'].includes(action)&&!reason?.value.trim()){message.textContent='Укажи короткую причину.';reason?.focus();return;}
        for(const b of buttons.children)b.disabled=true;message.textContent='Сохраняем…';
        try{await api('/api/loans/'+encodeURIComponent(row.id),{method:'PATCH',body:JSON.stringify({action,version:row.version,lender:lender?.value,reason:reason?.value.trim()||''})});if(account!==epoch)return;load();show(row.id);}
        catch(error){if(account!==epoch)return;message.textContent=error.message;if(error.status===409){const refresh=node('button','Обновить заявку','template-btn');refresh.type='button';refresh.onclick=()=>show(row.id);message.append(document.createElement('br'),refresh);}for(const b of buttons.children)b.disabled=false;}
      };
    }
    form.onsubmit=event=>event.preventDefault();form.append(buttons,message);if(actions.length)body.append(form);
    if(row.history?.length){const history=node('details','','loans-history');history.append(node('summary','История договорённости'));for(const item of row.history){history.append(node('p',[new Date(item.at).toLocaleString('ru-RU'),item.by,actionLabels[item.action]||({'request':'Заявка отправлена',submitted:'Заявка отправлена',create:'Заявка отправлена'})[item.action]||item.action,item.reason].filter(Boolean).join(' · ')));}body.append(history);}
  }
  function start(config){epoch++;sequence++;selectedSequence++;session=config;rows=[];selected=null;requestId=null;signature='';pending=false;init();if(!initialized)return;for(const id of ['loanRequestDialog','loanDetailDialog'])if($(id).open)$(id).close();$('loanRequestForm').reset();for(const input of $('loanRequestForm').querySelectorAll('input,textarea,button'))input.disabled=false;$('loanNickname').value=config.username;$('loansList').replaceChildren();$('loansStatus').textContent='';$('loansFilter').value='all';}
  function subscribe(socket){
    if(socket.__hubLoansBound)return;socket.__hubLoansBound=true;
    const join=()=>{if(session?.token)socket.emit('loan_subscribe',session.token);};socket.on('connect',join);join();
    socket.on('loan_changed',async event=>{if(!session||!event?.id)return;const account=epoch;if(document.body.dataset.hubPage==='loans')load();if($('loanDetailDialog')?.open&&selected===event.id)show(event.id);if(!event.notify)return;
      try{const {loan}=await api('/api/loans/'+encodeURIComponent(event.id));if(account!==epoch)return;session.notify({kind:'loan',loanId:loan.id,title:'Трюфели · '+statusText(loan),text:loan.borrower+' · '+loan.quantity+' баллов · вернуть до '+dateLabel(loan.dueDate)});}catch{}
    });
  }
  document.addEventListener('DOMContentLoaded',init);
  window.HubLoans={start,subscribe,load,open:id=>{if(!session)return;window.HubWorkspace?.open('loans');if(id)show(id);}};
})();
