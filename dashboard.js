document.addEventListener('DOMContentLoaded', () => {

  let taxData = { paye: 0, vat: 0, consumption: 0, transactions: [] };
  let chart;

  function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.menu a').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`[data-page="${id}"]`);
    if (activeLink) activeLink.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function calculatePAYE() {
    const gross = Number(document.getElementById('gross').value || 0);
    const pension = Number(document.getElementById('pension').value || 0);
    const nhf = Number(document.getElementById('nhf').value || 0);
    const other = Number(document.getElementById('otherReliefs').value || 0);
    const reliefs = pension + nhf + other + 200000;
    const taxable = Math.max(gross - reliefs, 0);
    const tax = taxable * 0.15;
    addTransaction(new Date().toISOString().split('T')[0], 'PAYE', tax, 'Salary Tax Calculation');
    document.getElementById('payeResult').innerText = `Estimated PAYE: ₦${tax.toLocaleString()}`;
  }

  function calculateVAT(amount, details, type) {
    const vatAmount = type === 'VAT' ? amount * 0.075 : amount;
    addTransaction(new Date().toISOString().split('T')[0], type, vatAmount, details);
    document.getElementById('vatResult').innerText = `${type} Added: ₦${vatAmount.toLocaleString()}`;
  }

  function addTransaction(date, type, amount, details) {
    taxData.transactions.push({ date, type, amount, details });
    renderTransactions();
    updateSummary();
  }

  function renderTransactions() {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = '';
    taxData.transactions.forEach(tx => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${tx.date}</td><td>${tx.type}</td><td>₦${tx.amount.toLocaleString()}</td><td>${tx.details}</td>`;
      tbody.appendChild(row);
    });
  }

  function updateSummary() {
    const totalPAYE = taxData.transactions.filter(t => t.type === 'PAYE').reduce((sum, t) => sum + t.amount, 0);
    const totalVAT = taxData.transactions.filter(t => t.type === 'VAT').reduce((sum, t) => sum + t.amount, 0);
    const totalConsumption = taxData.transactions.filter(t => t.type === 'Consumption').reduce((sum, t) => sum + t.amount, 0);

    taxData.paye = totalPAYE;
    taxData.vat = totalVAT;
    taxData.consumption = totalConsumption;

    document.getElementById('cardIncome').innerText = `₦${totalPAYE.toLocaleString()}`;
    document.getElementById('cardVAT').innerText = `₦${totalVAT.toLocaleString()}`;
    document.getElementById('cardConsumption').innerText = `₦${totalConsumption.toLocaleString()}`;

    if (chart) {
      chart.data.datasets[0].data = [totalPAYE, totalVAT, totalConsumption];
      chart.update();
    }
  }

  const addManualBtn = document.getElementById('addManualTransactionBtn');
  if (addManualBtn) {
    addManualBtn.addEventListener('click', e => {
      e.preventDefault();
      const amount = Number(document.getElementById('vatAmountManual').value || 0);
      const details = document.getElementById('vatDetailsManual').value || 'Manual Entry';
      const type = document.getElementById('vatTypeManual').value;
      if (amount > 0) calculateVAT(amount, details, type);
      document.getElementById('vatAmountManual').value = '';
      document.getElementById('vatDetailsManual').value = '';
    });
  }

  const vatFileInput = document.getElementById('vatFileInput');
  const ocrPreview = document.getElementById('ocrPreview');
  const confirmBtn = document.getElementById('confirmOCR');

  if (vatFileInput && ocrPreview && confirmBtn) {
    let ocrLines = [];

    vatFileInput.addEventListener('change', async e => {
      const files = Array.from(e.target.files);
      ocrPreview.innerHTML = '';
      document.getElementById('vatResult').innerText = 'Processing receipts, please wait...';

      for (const file of files) {
        if (!file.name.endsWith('.csv')) {
          await processReceiptEditable(file);
        }
      }

      document.getElementById('vatResult').innerText = 'Edit lines if needed, then click "Add Selected Transactions".';
    });

    async function processReceiptEditable(file) {
      if (!window.Tesseract) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4.0.2/dist/tesseract.min.js';
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
      }

      document.getElementById('vatResult').innerText = `Analyzing ${file.name}...`;

      const { data: { text } } = await Tesseract.recognize(file, 'eng', { logger: m => console.log(m) });
      ocrLines = [];
      ocrPreview.innerHTML = `<h4>OCR Preview for ${file.name}</h4>`;

      text.split('\n').forEach((line, idx) => {
        const matches = line.match(/(\d{2,3}(?:,\d{3})*(?:\.\d{2})?)/g) || [];
        matches.forEach(numStr => {
          const rawAmount = Number(numStr.replace(/,/g, ''));
          if (rawAmount > 0) {
      
            let type = 'Consumption';
            if (/vat|tax|excise/i.test(line)) type = 'VAT';
            else if (rawAmount < 1000 && /vat|tax/i.test(line)) type = 'VAT';
   
            const details = line.replace(numStr, '').trim() || 'Receipt Entry';
            const lineObj = { type, amount: rawAmount, details };
            ocrLines.push(lineObj);

            const lineDiv = document.createElement('div');
            lineDiv.style.marginBottom = '6px';
            lineDiv.innerHTML = `
              <input type="checkbox" id="ocrLine${idx}-${rawAmount}" checked>
              <input type="number" id="ocrAmount${idx}-${rawAmount}" value="${rawAmount}" style="width:80px;margin-left:5px;">
              <select id="ocrType${idx}-${rawAmount}" style="margin-left:5px;">
                <option value="VAT" ${type==='VAT'?'selected':''}>VAT</option>
                <option value="Consumption" ${type==='Consumption'?'selected':''}>Consumption</option>
              </select>
              <input type="text" id="ocrDetails${idx}-${rawAmount}" value="${details}" style="width:400px;margin-left:5px;">
            `;
            ocrPreview.appendChild(lineDiv);
          }
        });
      });
    }

    confirmBtn.addEventListener('click', () => {
      const dateStr = new Date().toISOString().split('T')[0];
      ocrLines.forEach((line, idx) => {
        const checkbox = document.getElementById(`ocrLine${idx}-${line.amount}`);
        const amountInput = document.getElementById(`ocrAmount${idx}-${line.amount}`);
        const typeSelect = document.getElementById(`ocrType${idx}-${line.amount}`);
        const detailsInput = document.getElementById(`ocrDetails${idx}-${line.amount}`);

        if (checkbox && checkbox.checked && amountInput && typeSelect && detailsInput) {
          const amount = Number(amountInput.value);
          const type = typeSelect.value;
          const details = detailsInput.value;
          if (type === 'VAT') addTransaction(dateStr, 'VAT', amount * 0.075, details);
          else addTransaction(dateStr, 'Consumption', amount, details);
        }
      });

      ocrPreview.innerHTML = '';
      document.getElementById('vatResult').innerText = 'Selected transactions added successfully.';
      vatFileInput.value = '';
    });
  }

  const ctx = document.getElementById('taxChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Income Tax', 'VAT', 'Consumption'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: ['#1ea672', '#16a085', '#10b981']
      }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });

  showPage('salary');

});

