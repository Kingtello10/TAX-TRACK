/**
 * TaxTrack NG - Dashboard OCR & File Processing
 * Handles receipt scanning and CSV imports
 */

document.addEventListener('DOMContentLoaded', () => {
  // Only run if TaxTrack app is loaded
  if (!window.TaxTrack) {
    console.warn('TaxTrack app not loaded');
    return;
  }

  // OCR Preview elements
  const vatFileInput = document.getElementById('vatFileInput');
  const ocrPreview = document.getElementById('ocrPreview');
  const confirmBtn = document.getElementById('confirmOCR');
  
  if (!vatFileInput || !ocrPreview || !confirmBtn) {
    return; // Elements not on this page
  }

  let ocrLines = [];

  // File input handler
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
      if (vatResult) {
        vatResult.innerHTML = '<i class="fas fa-info-circle"></i> Review OCR results below, then click "Confirm Selected Transactions"';
      }
    } else if (csvProcessed > 0) {
      if (vatResult) {
        vatResult.innerHTML = `<i class="fas fa-check-circle"></i> ${csvProcessed} CSV file(s) processed successfully!`;
      }
      // Refresh transactions display
      if (typeof renderTransactions === 'function') renderTransactions();
      if (typeof updateSummary === 'function') updateSummary();
    } else if (!hasImages) {
      if (vatResult) {
        vatResult.style.display = 'none';
      }
    }
  });

  // Process CSV file
  async function processCSV(file) {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      let addedCount = 0;
      
      // Skip header row if it looks like a header
      const startIndex = lines[0].toLowerCase().includes('date') || 
                        lines[0].toLowerCase().includes('amount') ? 1 : 0;
      
      for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
        
        if (cols.length >= 2) {
          // Try to find an amount in the columns
          let amount = 0;
          let details = '';
          
          for (const col of cols) {
            const numVal = parseFloat(col.replace(/[₦,]/g, ''));
            if (!isNaN(numVal) && numVal > 0 && amount === 0) {
              amount = numVal;
            } else if (col && !numVal && col.length > 2) {
              details = col;
            }
          }
          
          if (amount > 0) {
            const vatAmount = window.TaxTrack.calculateVAT(amount);
            window.TaxTrack.addTransaction({
              type: 'VAT',
              amount: vatAmount,
              details: details || `CSV Import: ${file.name}`
            });
            addedCount++;
          }
        }
      }
      
      if (addedCount > 0) {
        window.TaxTrack.showToast(`Added ${addedCount} transactions from ${file.name}`, 'success');
      }
      
    } catch (error) {
      console.error('CSV Error:', error);
      window.TaxTrack.showToast(`Error processing ${file.name}`, 'error');
    }
  }

  // Process receipt with OCR
  async function processReceiptWithOCR(file) {
    // Load Tesseract.js if not already loaded
    if (!window.Tesseract) {
      try {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4.0.2/dist/tesseract.min.js';
        document.head.appendChild(script);
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
      } catch (error) {
        console.error('Failed to load Tesseract:', error);
        window.TaxTrack.showToast('Failed to load OCR library', 'error');
        return;
      }
    }

    const vatResult = document.getElementById('vatResult');
    if (vatResult) {
      vatResult.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Analyzing ${file.name}...`;
    }

    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text' && vatResult) {
            const progress = Math.round(m.progress * 100);
            vatResult.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Scanning: ${progress}%`;
          }
        }
      });
      
      // Create preview header
      const headerDiv = document.createElement('div');
      headerDiv.innerHTML = `
        <h4 style="color: var(--accent); margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-receipt"></i> 
          OCR Results: ${file.name}
        </h4>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px;">
          Review detected amounts and edit if needed. Check the items you want to add.
        </p>
      `;
      ocrPreview.appendChild(headerDiv);

      // Parse OCR text for amounts
      const lines = text.split('\n');
      let foundItems = 0;
      
      lines.forEach((line, lineIndex) => {
        // Match various number formats
        const matches = line.match(/[\d,]+\.?\d{0,2}/g) || [];
        
        matches.forEach(numStr => {
          const rawAmount = parseFloat(numStr.replace(/,/g, ''));
          
          // Filter reasonable amounts (between 100 and 10 million Naira)
          if (rawAmount >= 100 && rawAmount <= 10000000) {
            // Determine type based on context
            let type = 'Consumption';
            const lineLower = line.toLowerCase();
            if (/vat|tax|excise|levy/.test(lineLower)) {
              type = 'VAT';
            }
            
            // Clean up details
            let details = line
              .replace(numStr, '')
              .replace(/[^\w\s]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 50);
            
            if (!details || details.length < 3) {
              details = 'Receipt Item';
            }
            
            const lineId = `ocr-${lineIndex}-${rawAmount}-${Math.random().toString(36).substr(2, 4)}`;
            const lineObj = { 
              id: lineId,
              type, 
              amount: rawAmount, 
              details 
            };
            ocrLines.push(lineObj);

            // Create editable row
            const lineDiv = document.createElement('div');
            lineDiv.className = 'ocr-line';
            lineDiv.style.cssText = `
              display: flex; 
              align-items: center; 
              gap: 12px; 
              margin-bottom: 12px; 
              padding: 14px 16px; 
              background: var(--glass-bg); 
              border: 1px solid var(--border);
              border-radius: 12px; 
              flex-wrap: wrap;
            `;
            lineDiv.innerHTML = `
              <input type="checkbox" id="check-${lineId}" checked 
                style="width: 20px; height: 20px; accent-color: var(--accent); cursor: pointer;">
              <input type="number" id="amount-${lineId}" value="${rawAmount}" 
                style="width: 120px; padding: 10px 12px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-family: var(--font-mono);">
              <select id="type-${lineId}" 
                style="padding: 10px 12px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); min-width: 130px;">
                <option value="VAT" ${type === 'VAT' ? 'selected' : ''}>VAT (7.5%)</option>
                <option value="Consumption" ${type === 'Consumption' ? 'selected' : ''}>Consumption</option>
              </select>
              <input type="text" id="details-${lineId}" value="${details}" 
                style="flex: 1; min-width: 180px; padding: 10px 12px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary);">
            `;
            ocrPreview.appendChild(lineDiv);
            foundItems++;
          }
        });
      });

      if (foundItems === 0) {
        ocrPreview.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--text-muted);">
            <i class="fas fa-search" style="font-size: 2.5rem; margin-bottom: 16px; display: block; opacity: 0.5;"></i>
            <p>No amounts detected in this receipt.</p>
            <p style="font-size: 0.85rem; margin-top: 8px;">Try a clearer image or enter the amounts manually above.</p>
          </div>
        `;
        confirmBtn.style.display = 'none';
      }
      
    } catch (error) {
      console.error('OCR Error:', error);
      const vatResult = document.getElementById('vatResult');
      if (vatResult) {
        vatResult.innerHTML = `<i class="fas fa-exclamation-circle"></i> Error processing image. Please try again.`;
      }
      window.TaxTrack.showToast('OCR processing failed', 'error');
    }
  }

  // Confirm OCR transactions
  confirmBtn.addEventListener('click', () => {
    let addedCount = 0;

    ocrLines.forEach(line => {
      const checkbox = document.getElementById(`check-${line.id}`);
      const amountInput = document.getElementById(`amount-${line.id}`);
      const typeSelect = document.getElementById(`type-${line.id}`);
      const detailsInput = document.getElementById(`details-${line.id}`);

      if (checkbox && checkbox.checked && amountInput && typeSelect && detailsInput) {
        const amount = parseFloat(amountInput.value);
        const type = typeSelect.value;
        const details = detailsInput.value;

        if (amount > 0) {
          // Calculate VAT if type is VAT
          const finalAmount = type === 'VAT' 
            ? window.TaxTrack.calculateVAT(amount) 
            : amount;
          
          window.TaxTrack.addTransaction({
            type: type,
            amount: finalAmount,
            details: type === 'VAT' ? `${details} (Base: ₦${amount.toLocaleString()})` : details
          });
          addedCount++;
        }
      }
    });

    // Clear preview
    ocrPreview.innerHTML = '';
    confirmBtn.style.display = 'none';
    ocrLines = [];

    const vatResult = document.getElementById('vatResult');
    if (vatResult) {
      vatResult.innerHTML = `<i class="fas fa-check-circle"></i> ${addedCount} transaction(s) added successfully!`;
    }

    vatFileInput.value = '';

    // Refresh dashboard displays
    if (typeof renderTransactions === 'function') renderTransactions();
    if (typeof updateSummary === 'function') updateSummary();

    window.TaxTrack.showToast(`Added ${addedCount} transactions from receipt`, 'success');
  });

});
