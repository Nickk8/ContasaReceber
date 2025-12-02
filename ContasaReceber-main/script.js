/* Estruturas:
   clients: [{id,name,phone,email}]
   invoices: [{id,clientId,description,amount,issueDate,dueDate,status,payDate}]
*/

(() => {
  // helpers
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const formatMoney = v => {
    const num = Number(v) || 0;
      
    const fixed = (Math.round(num * 100) / 100).toFixed(2);
    return fixed.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  const uid = () => 'id' + Math.random().toString(36).slice(2,9);

  // Storage
  const DB = {
    clients: JSON.parse(localStorage.getItem('cr_clients') || '[]'),
    invoices: JSON.parse(localStorage.getItem('cr_invoices') || '[]'),
    save(){ localStorage.setItem('cr_clients', JSON.stringify(this.clients)); localStorage.setItem('cr_invoices', JSON.stringify(this.invoices)); }
  };

  // Elementos ($$ array ; $ elementos únicos)
  const pages = $$('.page');
  const navBtns = $$('.nav-btn');
  const btnAddClient = $('#btnAddClient');
  const btnAddInvoice = $('#btnAddInvoice');
  const modalClient = $('#modalClient');
  const modalInvoice = $('#modalInvoice');
  const formClient = $('#formClient');
  const formInvoice = $('#formInvoice');
  const clientsList = $('#clientsList');
  const invoicesList = $('#invoicesList');
  const recentInvoices = $('#recentInvoices');
  const invoiceClientSelect = $('#invoiceClientSelect');
  const toastEl = $('#toast');
  const globalSearch = $('#globalSearch');

  // filters
  const filterStatus = $('#filterStatus');
  const filterClient = $('#filterClient');
  const filterDate = $('#filterDate');
  const clienteSearch = $('#clienteSearch');

  // dashboard KPIs
  const totalReceberEl = $('#totalReceber');
  const totalVencidasEl = $('#totalVencidas');
  const totalRecebidasMesEl = $('#totalRecebidasMes');
  const reportByClient = $('#reportByClient');
  const countOpen = $('#countOpen');
  const countOverdue = $('#countOverdue');

  // navigação
  navBtns.forEach(b => b.addEventListener('click', e => {
    navBtns.forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const target = b.dataset.target;
    pages.forEach(p => p.id === target ? p.classList.add('active') : p.classList.remove('active'));
    if(target === 'faturas') renderInvoices();
    if(target === 'clientes') renderClients();
    if(target === 'dashboard') renderDashboard();
  }));

  // abrir modais
  btnAddClient.addEventListener('click', () => openModal(modalClient));
  btnAddInvoice.addEventListener('click', () => {
    populateClientSelect();
    openModal(modalInvoice);
  });

  // fechar modals
  $$('[data-close]', document).forEach(btn => btn.addEventListener('click', () => {
    closeModal(btn.closest('.modal'));
  }));

  function openModal(el){ el.classList.remove('hidden'); }
  function closeModal(el){ el.classList.add('hidden'); el.querySelector('form')?.reset(); }
 
  // ADICIONAR clientes
  formClient.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(formClient);
    const name = fd.get('name').trim();
    const phone = fd.get('phone').trim();
    const email = fd.get('email').trim();
    
    // Validar telefone: apenas números
    if(phone && !/^\d+$/.test(phone.replace(/\D/g, ''))){
      showToast('Telefone deve conter apenas números');
      return;
    } 
  
    
    const client = { id: uid(), name, phone, email };
    DB.clients.push(client);
    DB.save();
    showToast('Cliente cadastrado');  
    closeModal(modalClient);
    renderClients();
  });

  // ADICIONAR fatura
  formInvoice.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(formInvoice);
    const invoice = {
      id: uid(),
      clientId: fd.get('clientId'),
      description: fd.get('description') || '',
      amount: Number(fd.get('amount')) || 0,
      issueDate: fd.get('issueDate'),
      dueDate: fd.get('dueDate'),
      status: 'open',
      payDate: null
    };
    DB.invoices.push(invoice);
    DB.save();
    showToast('Fatura criada');
    closeModal(modalInvoice);
    renderInvoices();
    renderDashboard();
  });

  // renderiza o cliente selecionar para formulário de fatura
  function populateClientSelect(){
    invoiceClientSelect.innerHTML = '';
    if(DB.clients.length === 0){
      invoiceClientSelect.innerHTML = `<option value="">-- nenhum cliente --</option>`;
      return;
    }
    DB.clients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.name;
      invoiceClientSelect.appendChild(opt);
    });
  }

  // render clientes
  function renderClients(filter = ''){
    clientsList.innerHTML = '';
    const list = DB.clients.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));
    if(list.length === 0){
      clientsList.innerHTML = `<div class="item"><div class="meta"><div>No clients yet</div></div></div>`;
      return;
    }
    list.forEach(c => {
      const wrap = document.createElement('div');
      wrap.className = 'item';
      wrap.innerHTML = `
        <div class="meta">
          <div class="avatar">${(c.name||'U').slice(0,1).toUpperCase()}</div>
          <div>
            <div style="font-weight:700">${c.name}</div>
            <div class="text-sm">${c.email || c.phone || ''}</div>
          </div>
        </div>
        <div>
          <button class="btn-ghost" data-id="${c.id}" data-action="view">Ver</button>
          <button class="btn-ghost" data-id="${c.id}" data-action="remove">Remover</button>
        </div>
      `;
      clientsList.appendChild(wrap);
      // ações
      wrap.querySelector('[data-action="remove"]').addEventListener('click', () => {
        DB.clients = DB.clients.filter(x => x.id !== c.id);
        // TAMBEM REMOVER FATURAS DOS CLIENTES
        DB.invoices = DB.invoices.filter(inv => inv.clientId !== c.id);
        DB.save();
        renderClients();
        renderInvoices();
        renderDashboard();
        showToast('Cliente removido');
      });
    });
  }

  // render invoices
  function statusOf(inv){
    const today = new Date().toISOString().slice(0,10);
    if(inv.status === 'paid') return 'paid';
    if(inv.dueDate < today && inv.status !== 'paid') return 'overdue';
    return 'open';
  }
  function renderInvoices({status='all', clientFilter='', dateFilter='', search=''} = {}){
    invoicesList.innerHTML = '';
    const today = new Date().toISOString().slice(0,10);
    let list = DB.invoices.slice().sort((a,b) => a.dueDate.localeCompare(b.dueDate));
    // COMPUTAR O STATUS DINAMICAMENTE 
    list = list.map(inv => ({...inv, computedStatus: statusOf(inv)}));

    if(status !== 'all') list = list.filter(i => i.computedStatus === status);
    if(clientFilter) {
      const q = clientFilter.toLowerCase();
      const matches = DB.clients.filter(c => c.name.toLowerCase().includes(q)).map(x => x.id);
      list = list.filter(i => matches.includes(i.clientId));
    }
    if(dateFilter) list = list.filter(i => i.dueDate === dateFilter);
    if(search) {
      const q = search.toLowerCase();
      list = list.filter(i => {
        const client = DB.clients.find(c => c.id === i.clientId);
        return (i.description || '').toLowerCase().includes(q) || (client?.name||'').toLowerCase().includes(q);
      });
    }

    if(list.length === 0){
      invoicesList.innerHTML = `<div class="item"><div class="meta"><div class="text-sm">Nenhuma fatura encontrada</div></div></div>`;
      return;
    }

    list.forEach(i => {
      const client = DB.clients.find(c => c.id === i.clientId) || {name:'Cliente removido'};
      const item = document.createElement('div');
      item.className = 'item';
      const st = i.computedStatus;
      const badgeClass = st === 'paid' ? 'badge paid' : (st === 'overdue' ? 'badge overdue' : 'badge open');
      item.innerHTML = `
        <div class="meta">
          <div style="min-width:160px">
            <div style="font-weight:700">${client.name}</div>
            <div class="text-sm">${i.description}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700">R$ ${formatMoney(i.amount)}</div>
            <div class="text-sm">Venc: ${i.dueDate}</div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
          <div class="${badgeClass}">${st === 'open' ? 'Em aberto' : st === 'paid' ? 'Pago' : 'Vencida'}</div>
          <div style="display:flex;gap:8px">
            ${st !== 'paid' ? `<button class="btn-ghost" data-action="pay" data-id="${i.id}">Marcar pago</button>` : `<button class="btn-ghost" data-action="receipt" data-id="${i.id}">Comprovante</button>`}
            <button class="btn-ghost" data-action="remove" data-id="${i.id}">Remover</button>
          </div>
        </div>
      `;
      invoicesList.appendChild(item);

      // actions
      item.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action, id = btn.dataset.id;
          if(action === 'pay'){
            const inv = DB.invoices.find(x => x.id === id);
            inv.status = 'paid';
            inv.payDate = new Date().toISOString().slice(0,10);
            DB.save();
            showToast('Fatura marcada como paga');
            renderInvoices({status: filterStatus.value, clientFilter: filterClient.value, dateFilter: filterDate.value, search: globalSearch.value});
            renderDashboard();
          } else if(action === 'remove'){
            DB.invoices = DB.invoices.filter(x => x.id !== id);
            DB.save();
            showToast('Fatura removida');
            renderInvoices({status: filterStatus.value, clientFilter: filterClient.value, dateFilter: filterDate.value, search: globalSearch.value});
            renderDashboard();
          } else if(action === 'receipt'){
            showToast('Comprovante (simulado) — pago em ' + (DB.invoices.find(x=>x.id===id).payDate || '-'));
          }
        });
      });
    });
  }

  // render recent invoices (dashboard)
  function renderRecent(){
    recentInvoices.innerHTML = '';
    const list = DB.invoices.slice().sort((a,b) => b.issueDate.localeCompare(a.issueDate)).slice(0,5);
    if(list.length === 0){ recentInvoices.innerHTML = `<div class="text-sm">Sem faturas</div>`; return; }
    list.forEach(i => {
      const client = DB.clients.find(c => c.id === i.clientId) || {name:'Cliente removido'};
      const el = document.createElement('div');
      el.className = 'item';
      const s = statusOf(i);
      el.innerHTML = `
        <div class="meta">
          <div>
            <div style="font-weight:700">${client.name}</div>
            <div class="text-sm">${i.description || '—'}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">R$ ${formatMoney(i.amount)}</div>
          <div class="text-sm">${i.dueDate}</div>
        </div>
      `;
      recentInvoices.appendChild(el);
    });
  }

  // dashboard totals
  function renderDashboard(){
    // totals
    const today = new Date().toISOString().slice(0,10);
    let totalReceber = 0, totalVencidas = 0, totalRecebidasMes = 0;
    const now = new Date();
    const currMonth = now.toISOString().slice(0,7); // YYYY-MM
    DB.invoices.forEach(inv => {
      if(inv.status !== 'paid'){
        totalReceber += Number(inv.amount || 0);
      }
      if(inv.dueDate < today && inv.status !== 'paid'){
        totalVencidas += Number(inv.amount || 0);
      }
      if(inv.status === 'paid' && inv.payDate && inv.payDate.slice(0,7) === currMonth){
        totalRecebidasMes += Number(inv.amount || 0);
      }
    });

    totalReceberEl.textContent = 'R$ ' + formatMoney(totalReceber);
    totalVencidasEl.textContent = 'R$ ' + formatMoney(totalVencidas);
    totalRecebidasMesEl.textContent = 'R$ ' + formatMoney(totalRecebidasMes);

    // report by client (top)
    const totalsByClient = {};
    DB.invoices.forEach(i => {
      if(!totalsByClient[i.clientId]) totalsByClient[i.clientId] = 0;
      totalsByClient[i.clientId] += Number(i.amount || 0);
    });
    const entries = Object.entries(totalsByClient);
    const top = entries.sort((a,b)=>b[1]-a[1])[0];
    if(top){
      const client = DB.clients.find(c => c.id === top[0]);
      reportByClient.textContent = `${client ? client.name : 'Cliente removido'} — R$ ${formatMoney(top[1])}`;
    } else reportByClient.textContent = '—';

    // CONTAS
    const openCount = DB.invoices.filter(i => statusOf(i) === 'open').length;
    const overdueCount = DB.invoices.filter(i => statusOf(i) === 'overdue').length;
    countOpen.textContent = openCount;
    countOverdue.textContent = overdueCount;

    renderRecent();
    renderChart();
  }

  // simple monthly chart (last 6 months)
  let chartInstance = null;
  function renderChart(){
    const ctx = document.getElementById('chartFlow');
    if(!ctx) return;
    // prepare months
    const date = new Date();
    const labels = [];
    const receivable = [];
    for(let i=5;i>=0;i--){
      const d = new Date(date.getFullYear(), date.getMonth()-i, 1);
      const key = d.toISOString().slice(0,7); // YYYY-MM
      labels.push(d.toLocaleString('pt-BR',{month:'short', year:'numeric'}));
      // sum invoices due that month
      const sum = DB.invoices.filter(inv => inv.dueDate.slice(0,7) === key).reduce((s,inv) => s + Number(inv.amount || 0), 0);
      receivable.push(sum);
    }
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Vencimentos',
          data: receivable,
          backgroundColor: 'rgba(167,139,250,0.9)'
        }]
      },
      options: {
        plugins:{legend:{display:false}},
        scales:{y:{ticks:{callback:val=> 'R$ ' + formatMoney(val)}}}
      }
    });
  }

  // toast
  let toastTimer = null;
  function showToast(msg='Feito'){
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> toastEl.classList.add('hidden'), 2200);
  }

  // listeners: filters and search
  filterStatus.addEventListener('change', () => renderInvoices({status: filterStatus.value, clientFilter: filterClient.value, dateFilter: filterDate.value, search: globalSearch.value}));
  filterClient.addEventListener('input', () => renderInvoices({status: filterStatus.value, clientFilter: filterClient.value, dateFilter: filterDate.value, search: globalSearch.value}));
  filterDate.addEventListener('change', () => renderInvoices({status: filterStatus.value, clientFilter: filterClient.value, dateFilter: filterDate.value, search: globalSearch.value}));
  globalSearch.addEventListener('input', () => {
    renderInvoices({status: filterStatus.value, clientFilter: filterClient.value, dateFilter: filterDate.value, search: globalSearch.value});
    renderClients(globalSearch.value);
  });
  clienteSearch.addEventListener('input', () => renderClients(clienteSearch.value));

  // initial seed (if empty) to help demo
  function seedIfEmpty(){
    if(DB.clients.length === 0 && DB.invoices.length === 0){
      const c1 = {id: uid(), name: 'João Silva', phone:'(85) 9 9999-0000', email:'joao@mail.com'};
      const c2 = {id: uid(), name: 'Loja Flores', phone:'', email:'contato@flores.com'};
      DB.clients.push(c1, c2);
      const today = new Date();
      const d1 = new Date(today.getFullYear(), today.getMonth(), today.getDate()+7).toISOString().slice(0,10);
      const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate()+2).toISOString().slice(0,10);
      DB.invoices.push(
        {id: uid(), clientId: c1.id, description:'Serviço de manutenção', amount: 350.50, issueDate: today.toISOString().slice(0,10), dueDate: d1, status:'open', payDate:null},
        {id: uid(), clientId: c2.id, description:'Venda de produto X', amount: 120.00, issueDate: today.toISOString().slice(0,10), dueDate: d2, status:'open', payDate:null}
      );
      DB.save();
    }
  }

  // initial render
  seedIfEmpty();
  renderDashboard();
  renderClients();
  renderInvoices();

  // make nav work on load
  document.addEventListener('DOMContentLoaded', () => {
    // quick keyboard: n for new invoice
    document.addEventListener('keydown', (e) => { if(e.key === 'n') { populateClientSelect(); openModal(modalInvoice); }});
  });

})();
