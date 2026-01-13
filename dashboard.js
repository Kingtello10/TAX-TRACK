/**
 * TaxTrack NG - Dashboard OCR & File Processing
 * Handles receipt scanning and CSV imports
 */

document.addEventListener('DOMContentLoaded', async () => {
  const app = window.TaxTrack;
  if (!app) {
    console.warn('TaxTrack app not loaded');
    return;
  }

  // Redirect if not logged in
  if (!app.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  // Ensure calculateVAT exists
  if (!app.calculateVAT) {
    app.calculateVAT = (amount) => Number((amount * 0.075).toFixed(2)); // 7.5% VAT
  }

  // Fetch existing transactions
  try {
    await app.fetchTransactions();
    if (typeof renderTransactions === 'function') renderTransactions();
    if (typeof updateSummary === 'function') updateSummary();
  } catch (err) {
    console.error('Failed to fetch transactions:', err);
  }

  // OCR Preview elements
  const vatFileInput = document.getElementById('vatFileInput');
  const ocrPreview = document.getElementById('ocrPreview');
  const confirmBtn = document.getElementById('confirmOCR');
  
  if (!vatFileInput || !ocrPreview || !confirmBtn) return;

  let ocrLines = [];

  // ===============================
  // File input handler
  // ===============================
  vatFileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    ocrPreview.innerHTML = '';
    ocrLines = [];

    const vatResult = document.getElementById('vatResult');
    if (vatResult) {
      vatResult.style.display = 'block';
      vatResult.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing files, please wait...';
    }

    let hasImages = false;
    let csvProcessed = 0;

    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.csv')) {
        await processCSV(file);
        csvProcessed++;
      } else if (file.type.startsWith('image/')) {
        hasImages = true;
        await processReceiptWithOCR(file);
      }
    }

    if (hasImages && ocrLines.length > 0) {
      confirmBtn.style.display = 'flex';
      if (vatResult) vatResult.innerHTML = '<i class="fas fa-info-circle"></i> Review OCR results below, then click "Confirm Selected Transactions"';
    } else if (csvProcessed > 0) {
      if (vatResult) vatResult.innerHTML = `<i class="fas fa-check-circle"></i> ${csvProcessed} CSV file(s) processed successfully!`;
      if (typeof renderTransactions === 'function') renderTransactions();
      if (typeof updateSummary === 'function') updateSummary();
    } else if (!hasImages && csvProcessed === 0) {
      if (vatResult) vatResult.style.display = 'none';
    }
  });

  // ===============================
  // Process CSV
  // ===============================
  async function processCSV(file) {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      let addedCount = 0;

      const startIndex = lines[0].toLowerCase().includes('date') || lines[0].toLowerCase().includes('amount') ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
        if (cols.length >= 2) {
          let amount = 0, details = '';
          for (const col of cols) {
            const numVal = parseFloat(col.replace(/[₦,]/g, ''));
            if (!isNaN(numVal) && numVal > 0 && amount === 0) amount = numVal;
            else if (col && !numVal && col.length > 2) details = col;
          }
          if (amount > 0) {
            const vatAmount = app.calculateVAT(amount);
            await app.addTransaction({ type: 'VAT', amount: vatAmount, details: details || `CSV Import: ${file.name}` });
            addedCount++;
          }
        }
      }

      if (addedCount > 0) app.showToast(`Added ${addedCount} transactions from ${file.name}`, 'success');
    } catch (error) {
      console.error('CSV Error:', error);
      app.showToast(`Error processing ${file.name}`, 'error');
    }
  }

  // ===============================
  // Process receipt with OCR
  // ===============================
  async function processReceiptWithOCR(file) {
    if (!window.Tesseract) {
      try {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4.0.2/dist/tesseract.min.js';
        document.head.appendChild(script);
        await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; });
      } catch (error) {
        console.error('Failed to load Tesseract:', error);
        app.showToast('Failed to load OCR library', 'error');
        return;
      }
    }

    const vatResult = document.getElementById('vatResult');
    if (vatResult) vatResult.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Analyzing ${file.name}...`;

    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: m => { if (m.status === 'recognizing text' && vatResult) vatResult.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Scanning: ${Math.round(m.progress*100)}%`; }
      });

      // --- parse OCR lines and render editable rows ---
      const lines = text.split('\n');
      ocrLines = [];

      lines.forEach((line, lineIndex) => {
        const matches = line.match(/[\d,]+\.?\d{0,2}/g) || [];
        matches.forEach(numStr => {
          const rawAmount = parseFloat(numStr.replace(/,/g, ''));
          if (rawAmount >= 100 && rawAmount <= 10000000) {
            let type = /vat|tax|excise|levy/i.test(line) ? 'VAT' : 'Consumption';
            let details = line.replace(numStr, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g,' ').trim().substring(0,50) || 'Receipt Item';
            const lineId = `ocr-${lineIndex}-${rawAmount}-${Math.random().toString(36).substr(2,4)}`;
            ocrLines.push({ id: lineId, type, amount: rawAmount, details });

            const lineDiv = document.createElement('div');
            lineDiv.className = 'ocr-line';
            lineDiv.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:12px;padding:14px 16px;background:var(--glass-bg);border:1px solid var(--border);border-radius:12px;flex-wrap:wrap;';
            lineDiv.innerHTML = `
              <input type="checkbox" id="check-${lineId}" checked style="width:20px;height:20px;accent-color:var(--accent);cursor:pointer;">
              <input type="number" id="amount-${lineId}" value="${rawAmount}" style="width:120px;padding:10px 12px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-family:var(--font-mono);">
              <select id="type-${lineId}" style="padding:10px 12px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);min-width:130px;">
                <option value="VAT" ${type==='VAT'?'selected':''}>VAT (7.5%)</option>
                <option value="Consumption" ${type==='Consumption'?'selected':''}>Consumption</option>
              </select>
              <input type="text" id="details-${lineId}" value="${details}" style="flex:1;min-width:180px;padding:10px 12px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);">
            `;
            ocrPreview.appendChild(lineDiv);
          }
        });
      });

      if (ocrLines.length === 0 && vatResult) {
        vatResult.innerHTML = '<i class="fas fa-info-circle"></i> No amounts detected. Try a clearer image or manual entry.';
        confirmBtn.style.display = 'none';
      } else {
        confirmBtn.style.display = 'flex';
      }

    } catch (error) {
      console.error('OCR Error:', error);
      if (vatResult) vatResult.innerHTML = `<i class="fas fa-exclamation-circle"></i> Error processing image.`;
      app.showToast('OCR processing failed', 'error');
    }
  }

  // ===============================
  // Confirm OCR transactions
  // ===============================
  confirmBtn.addEventListener('click', () => {
    let addedCount = 0;

    ocrLines.forEach(line => {
      const checkbox = document.getElementById(`check-${line.id}`);
      const amountInput = document.getElementById(`amount-${line.id}`);
      const typeSelect = document.getElementById(`type-${line.id}`);
      const detailsInput = document.getElementById(`details-${line.id}`);

      if (checkbox?.checked && amountInput && typeSelect && detailsInput) {
        const amount = parseFloat(amountInput.value);
        const type = typeSelect.value;
        const details = detailsInput.value;
        if (amount > 0) {
          const finalAmount = type==='VAT'? app.calculateVAT(amount) : amount;
          app.addTransaction({ type, amount: finalAmount, details: type==='VAT'? `${details} (Base: ₦${amount.toLocaleString()})` : details });
          addedCount++;
        }
      }
    });

    ocrPreview.innerHTML = '';
    confirmBtn.style.display = 'none';
    ocrLines = [];
    vatFileInput.value = '';

    const vatResult = document.getElementById('vatResult');
    if (vatResult) vatResult.innerHTML = `<i class="fas fa-check-circle"></i> ${addedCount} transaction(s) added successfully!`;

    if (typeof renderTransactions === 'function') renderTransactions();
    if (typeof updateSummary === 'function') updateSummary();
    app.showToast(`Added ${addedCount} transactions from receipt`, 'success');
  });

});
