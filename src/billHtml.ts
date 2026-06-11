import { SHOP } from './config';
import { LOGO_DATA_URI } from './logoAsset';
import { SIGNATURE_DATA_URI } from './signatureAsset';
import { t, translateNameOrItem } from './i18n';
import type { BillItemDraft, BillPayload, BillTransaction, LabourType, Language, ReceiptType } from './types';
import { calculateLabourCharge, calculateTotalFine, formatCalcValue, roundWeight } from './utils/calculations';
import { formatDateForBill, formatMoney, formatPlainNumber, parseAmount } from './utils/format';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cell(value: string, className = '') {
  return `<td${className ? ` class="${className}"` : ''}>${escapeHtml(value)}</td>`;
}

function roundToTen(value: number) {
  return Math.round(value / 10) * 10;
}

function roundRupeeForDisplay(value: string | number | null | undefined) {
  return Math.trunc(parseAmount(value));
}

function formatBillMoney(value: string | number | null | undefined, autoRoundFigure = false) {
  return formatMoney(autoRoundFigure ? roundToTen(parseAmount(value)) : roundRupeeForDisplay(value));
}

function itemRateDisplay(item: BillItemDraft) {
  const ratePerGram = parseAmount(item.rate);
  if (ratePerGram <= 0) {
    return '';
  }

  if (item.material === 'silver') {
    return formatMoney(ratePerGram * 1000);
  }

  return formatMoney(ratePerGram * 10);
}

function labourUnitLabel(type: LabourType | undefined) {
  return (type ?? 'gw') === 'pcs' ? 'pcs' : 'gw';
}

function itemLabourDisplay(item: BillItemDraft) {
  const labour = parseAmount(item.labour);
  return labour > 0 ? `${formatMoney(labour)}/${labourUnitLabel(item.labourType)}` : '';
}

function itemWeightDisplay(item: BillItemDraft) {
  const weight = parseAmount(item.weight);
  const packetLess = parseAmount(item.packetLess);
  if (weight <= 0) {
    return '';
  }
  if (packetLess <= 0) {
    return formatPlainNumber(item.weight);
  }

  const netWeight = Math.max(weight - packetLess, 0);
  return formatPlainNumber(netWeight);
}

function rateSummaryLines(items: BillItemDraft[]) {
  const values = new Map<string, string>();
  for (const item of visibleItems(items)) {
    const rate = itemRateDisplay(item);
    if (!rate) {
      continue;
    }
    const label = item.material === 'silver' ? 'Silver / 1 kg' : 'Gold / 10 gm';
    values.set(`${item.material}-${rate}`, `Booked rate - ${label}: ${rate}`);
  }

  return [...values.values()];
}

function bookedRateUnitCandidatesFromItems(items: BillItemDraft[]) {
  return visibleItems(items)
    .map((item) => {
      const ratePerGram = parseAmount(item.rate);
      if (ratePerGram <= 0) {
        return 0;
      }
      return item.material === 'silver' ? ratePerGram * 1000 : ratePerGram * 10;
    })
    .filter((value) => value > 0);
}

function sanitizePayloadDiscountAmount(payload: BillPayload) {
  const discountValue = parseAmount(payload.discountAmount);
  const rateCutFine = parseAmount(payload.rateCutFine);
  if (discountValue <= 0 || rateCutFine <= 0) {
    return discountValue;
  }

  const rateCutAmount = parseAmount(payload.rateCutAmount);
  const bookedRateCandidates = [parseAmount(payload.rateCutBookedRate), ...bookedRateUnitCandidatesFromItems(payload.items)].filter(
    (value) => value > 0,
  );
  const mirrorsRateCutAmount = rateCutAmount > 0 && Math.abs(discountValue - rateCutAmount) < 0.01;
  const mirrorsBookedRate = bookedRateCandidates.some((rate) => Math.abs(discountValue - rate) < 0.01);

  return mirrorsRateCutAmount || mirrorsBookedRate ? 0 : discountValue;
}

function labourSummaryLine(items: BillItemDraft[], autoRoundFigure = false) {
  const total = visibleItems(items).reduce((sum, item) => sum + calculateLabourCharge(item), 0);
  const otherTotal = visibleItems(items).reduce((sum, item) => sum + parseAmount(item.other), 0);
  const parts: string[] = [];
  if (total > 0) parts.push(`Labour: ${formatBillMoney(total, autoRoundFigure)}`);
  if (otherTotal > 0) parts.push(`Other: ${formatBillMoney(otherTotal, autoRoundFigure)}`);
  return parts.join(' | ');
}

function billTransactionSummary(payload: BillPayload, transactions: BillTransaction[] = []) {
  const openingFine = parseAmount(payload.customer.openingFineBalance);
  const openingAmountDue = parseAmount(payload.customer.openingLabourBalance);
  const billFineGiven = calculateTotalFine(visibleItems(payload.items));
  const fineGiven = openingFine + billFineGiven;
  const initialFineReceived = receiptHasFine(payload.receiptType) ? parseAmount(payload.receivedFine) : 0;
  const initialLabourReceived = payload.receivedValue;
  const initialRateCutFine = parseAmount(payload.rateCutFine);
  const initialRateCutAmount = parseAmount(payload.rateCutAmount);
  const discountAmount = sanitizePayloadDiscountAmount(payload);
  const cashBankReceived = transactions.reduce((sum, transaction) => sum + transaction.cashAmount + transaction.bankAmount, 0);
  const fineReceived = transactions.reduce((sum, transaction) => sum + transaction.fineWeight, 0);
  const rateCutFine = initialRateCutFine + transactions.reduce((sum, transaction) => sum + transaction.rateCutFine, 0);
  const rateCutAmount = initialRateCutAmount + transactions.reduce((sum, transaction) => sum + transaction.rateCutAmount, 0);
  const postRateCutAmount = transactions.reduce((sum, transaction) => sum + transaction.rateCutAmount, 0);
  const fineCleared = initialFineReceived + fineReceived + rateCutFine;
  const fineBalance = fineGiven - fineCleared;
  const billFineBalance = billFineGiven - fineCleared;
  const calculatedBillAmountDue = Math.max(payload.subtotal + initialRateCutAmount - initialLabourReceived - discountAmount, 0);
  const billAmountDue =
    payload.autoRoundFigure || parseAmount(payload.finalAmountOverride) > 0 ? payload.netTotal : calculatedBillAmountDue;
  const initialLabourBalance = Math.max(openingAmountDue + billAmountDue, 0);
  const billLabourBalance = Math.max(billAmountDue - cashBankReceived + postRateCutAmount, 0);

  return {
    cashBankReceived,
    billFineAdvance: Math.max(-billFineBalance, 0),
    billFineBalance: Math.max(billFineBalance, 0),
    billFineGiven,
    billLabourBalance,
    cashReceivedDisplay: initialLabourReceived + cashBankReceived,
    discountAmount,
    fineAdvance: Math.max(-fineBalance, 0),
    fineBalance: Math.max(fineBalance, 0),
    fineCleared,
    fineGiven,
    fineReceived,
    initialFineReceived,
    initialLabourReceived,
    initialRateCutAmount,
    initialRateCutFine,
    openingFine,
    openingAmountDue,
    rateCutAdjustsLabour: true,
    labourBalance: Math.max(initialLabourBalance - cashBankReceived + postRateCutAmount, 0),
    outstandingBeforeRateCut: Math.max(initialLabourBalance + postRateCutAmount, 0),
    postRateCutAmount,
    rateCutApplied: rateCutAmount,
    rateCutAmount,
    rateCutFine,
  };
}

function fieldHasValue(v: string) { return v.trim() && parseFloat(v) !== 0; }
function visibleItems(items: BillItemDraft[]) {
  return items.filter(
    (item) =>
      item.itemName.trim() ||
      fieldHasValue(item.weight) ||
      fieldHasValue(item.packetLess) ||
      fieldHasValue(item.touch) ||
      fieldHasValue(item.fine) ||
      fieldHasValue(item.pcs) ||
      fieldHasValue(item.rate) ||
      fieldHasValue(item.labour) ||
      fieldHasValue(item.amount),
  );
}

function paddedEstimateRows(items: BillItemDraft[]) {
  const rows = [...visibleItems(items)];
  const itemCount = rows.length;
  const blankRows = itemCount >= 9 ? 1 : itemCount <= 3 ? 3 : 2;
  const targetRows = Math.max(itemCount + blankRows, itemCount ? itemCount + 1 : 4);
  while (rows.length < targetRows) {
    rows.push({
      amount: '',
      fine: '',
      id: `blank-${rows.length}`,
      itemName: '',
      labour: '',
      labourType: 'gw',
      material: 'silver',
      other: '',
      packetLess: '',
      pcs: '',
      rate: '',
      touch: '',
      weight: '',
    });
  }
  return rows;
}

function estimateTotalRow(payload: BillPayload) {
  const items = visibleItems(payload.items);
  const totalWeight = roundWeight(items.reduce((sum, item) => sum + Math.max(parseAmount(item.weight) - parseAmount(item.packetLess), 0), 0));
  const totalFine = calculateTotalFine(items);
  const totalPcs = items.reduce((sum, item) => sum + parseAmount(item.pcs), 0);
  const labourTotal = items.reduce((sum, item) => sum + calculateLabourCharge(item), 0);
  const otherTotal = items.reduce((sum, item) => sum + parseAmount(item.other), 0);
  return `<tr class="total-row">
    ${cell('Total', 'item-cell')}
    ${cell(formatPlainNumber(totalWeight), 'num-cell weight-cell')}
    ${cell('', 'num-cell')}
    ${cell(formatPlainNumber(totalFine), 'num-cell')}
    ${cell(formatPlainNumber(totalPcs), 'num-cell')}
    ${cell(formatBillMoney(labourTotal, payload.autoRoundFigure), 'num-cell')}
    ${cell(formatBillMoney(otherTotal, payload.autoRoundFigure), 'num-cell')}
    ${cell(formatBillMoney(payload.subtotal, payload.autoRoundFigure), 'money-cell amount-cell')}
  </tr>`;
}

function logoHtml(className = 'logo') {
  return `<div class="${className}"><img src="${LOGO_DATA_URI}" alt="${escapeHtml(SHOP.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;" /></div>`;
}

function signatureHtml(label: string) {
  return `<div class="signature"><img class="signature-img" src="${SIGNATURE_DATA_URI}" alt="${escapeHtml(label)}" /><div class="signature-line">${escapeHtml(label)} :</div></div>`;
}

function ownerContactsHtml(className = 'owner-strip') {
  const owners = SHOP.owners ?? [];
  if (!owners.length) return '';
  return `<div class="${className}">${owners
    .map((owner) => `<span><b>${escapeHtml(owner.name)}</b>${owner.mobile ? `: ${escapeHtml(owner.mobile)}` : ''}</span>`)
    .join('<span class="owner-sep">|</span>')}</div>`;
}

function ownerContactCardsHtml() {
  const owners = SHOP.owners ?? [];
  if (!owners.length) return '';
  return `<section class="owner-grid">${owners
    .map(
      (owner) => `<div class="owner-card"><span>${escapeHtml(owner.name)}</span><b>${escapeHtml(owner.mobile)}</b></div>`,
    )
    .join('')}</section>`;
}

function shopAddressHtml(className = 'address-block') {
  const lines = SHOP.addressLines?.length ? SHOP.addressLines : [SHOP.address].filter(Boolean);
  if (!lines.length) return '';
  return `<div class="${className}">${lines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}</div>`;
}

function receiptHasFine(receiptType: ReceiptType) {
  return receiptType === 'fine' || receiptType === 'fine_cash';
}

function receiptHasCash(receiptType: ReceiptType) {
  return receiptType === 'cash' || receiptType === 'fine_cash';
}

function receiptDetailLines(payload: BillPayload) {
  const language = payload.language;
  const fineGiven = calculateTotalFine(visibleItems(payload.items));
  const fineReceived = receiptHasFine(payload.receiptType) ? parseAmount(payload.receivedFine) : 0;
  const fineBalance = fineGiven - fineReceived;
  const lines = [
    `${t(language, 'fineGiven')}: ${formatPlainNumber(fineGiven)} gm`,
    receiptHasFine(payload.receiptType)
      ? `${t(language, 'fineReceived')}: GW ${formatPlainNumber(payload.receivedGrossWeight)} x ${formatPlainNumber(
          payload.receivedTouch,
        )}% = ${formatPlainNumber(fineReceived)} gm`
      : `${t(language, 'fineReceived')}: 0 gm`,
    fineBalance >= 0
      ? `${t(language, 'fineBalance')}: ${formatPlainNumber(fineBalance)} gm`
      : `${t(language, 'fineAdvance')}: ${formatPlainNumber(Math.abs(fineBalance))} gm`,
  ];

  if (receiptHasCash(payload.receiptType)) {
    return [...lines, `${t(language, 'cashReceived')}: ${formatBillMoney(payload.receivedCash, payload.autoRoundFigure)}`];
  }

  return lines;
}

function receiptDetailLinesWithTransactions(payload: BillPayload, transactions: BillTransaction[] = []) {
  const hasInitialRateCut = parseAmount(payload.rateCutFine) > 0 || parseAmount(payload.rateCutAmount) > 0;
  const hasDiscount = sanitizePayloadDiscountAmount(payload) > 0;
  if (!transactions.length && !hasInitialRateCut && !hasDiscount) {
    return receiptDetailLines(payload);
  }

  const language = payload.language;
  const summary = billTransactionSummary(payload, transactions);
  const lines = [
    `${t(language, 'fineGiven')}: ${formatPlainNumber(summary.billFineGiven)} gm`,
    receiptHasFine(payload.receiptType)
      ? `${t(language, 'fineReceived')}: GW ${formatPlainNumber(payload.receivedGrossWeight)} x ${formatPlainNumber(
          payload.receivedTouch,
        )}% = ${formatPlainNumber(summary.initialFineReceived)} gm`
      : `${t(language, 'fineReceived')}: 0 gm`,
  ];

  if (summary.fineReceived > 0) {
    lines.push(`Post bill fine rec: ${formatPlainNumber(summary.fineReceived)} gm`);
  }
  if (summary.rateCutFine > 0) {
    lines.push(`Rate cut amount: ${formatPlainNumber(summary.rateCutFine)} gm = ${formatBillMoney(summary.rateCutAmount, payload.autoRoundFigure)}`);
  }
  if (summary.discountAmount > 0) {
    lines.push(`Discount: ${formatBillMoney(summary.discountAmount, payload.autoRoundFigure)}`);
  }
  lines.push(
    summary.billFineAdvance > 0
      ? `${t(language, 'fineAdvance')}: ${formatPlainNumber(summary.billFineAdvance)} gm`
      : `${t(language, 'fineBalance')}: ${formatPlainNumber(summary.billFineBalance)} gm`,
  );

  if (summary.initialLabourReceived > 0) {
    lines.push(`Amount received: ${formatBillMoney(summary.initialLabourReceived, payload.autoRoundFigure)}`);
  }
  if (summary.cashBankReceived > 0) {
    lines.push(`Post bill amount rec: ${formatBillMoney(summary.cashBankReceived, payload.autoRoundFigure)}`);
  }

  return lines;
}

type FooterInfoRow = {
  label: string;
  value: string;
};

function footerInfoSections(payload: BillPayload, transactions: BillTransaction[] = []) {
  const language = payload.language;
  const summary = billTransactionSummary(payload, transactions);
  const fineRows: FooterInfoRow[] = [
    { label: t(language, 'fineGiven'), value: `${formatPlainNumber(summary.billFineGiven)} gm` },
    {
      label: t(language, 'fineReceived'),
      value: receiptHasFine(payload.receiptType)
        ? `GW ${formatPlainNumber(payload.receivedGrossWeight)} x ${formatPlainNumber(payload.receivedTouch)}% = ${formatPlainNumber(summary.initialFineReceived)} gm`
        : '0 gm',
    },
  ];

  if (summary.fineReceived > 0) {
    fineRows.push({ label: 'Post bill fine rec', value: `${formatPlainNumber(summary.fineReceived)} gm` });
  }
  if (summary.rateCutFine > 0) {
    fineRows.push({ label: 'Rate cut fine less', value: `${formatPlainNumber(summary.rateCutFine)} gm` });
  }
  fineRows.push({
    label: summary.billFineAdvance > 0 ? t(language, 'fineAdvance') : t(language, 'fineBalance'),
    value: `${formatPlainNumber(summary.billFineAdvance > 0 ? summary.billFineAdvance : summary.billFineBalance)} gm`,
  });

  const moneyRows: FooterInfoRow[] = [];
  if (summary.initialLabourReceived > 0) {
    moneyRows.push({ label: 'Amount rec', value: formatBillMoney(summary.initialLabourReceived, payload.autoRoundFigure) });
  }
  if (summary.cashBankReceived > 0) {
    moneyRows.push({ label: 'Post bill cash/bank', value: formatBillMoney(summary.cashBankReceived, payload.autoRoundFigure) });
  }
  if (summary.discountAmount > 0) {
    moneyRows.push({ label: 'Discount', value: formatBillMoney(summary.discountAmount, payload.autoRoundFigure) });
  }

  return { fineRows, moneyRows };
}

function rateCutFooterNotes(payload: BillPayload, transactions: BillTransaction[] = []) {
  const summary = billTransactionSummary(payload, transactions);
  if (summary.rateCutAmount <= 0) {
    return [] as string[];
  }

  return [`(Added in labour: ${formatBillMoney(summary.rateCutAmount, payload.autoRoundFigure)})`];
}

function packetLessDetail(payload: BillPayload) {
  const total = visibleItems(payload.items).reduce((sum, item) => sum + parseAmount(item.packetLess), 0);
  return total > 0 ? `Note: Weight column final weight hai. Packet/box less total: ${formatPlainNumber(total)} gm` : '';
}

function receiptSummaryHtml(payload: BillPayload, transactions: BillTransaction[] = []) {
  const { fineRows, moneyRows } = footerInfoSections(payload, transactions);
  const bookedRateLines = rateSummaryLines(payload.items);
  const labourSummary = labourSummaryLine(payload.items, payload.autoRoundFigure);
  const packetLess = packetLessDetail(payload);
  const bookedRateHtml = bookedRateLines.length
    ? `<div class="booked-rates">${bookedRateLines
        .map((line) => `<div class="booked-line"><span>Booked rate</span><b>${escapeHtml(line.replace(/^Booked rate - /, ''))}</b></div>`)
        .join('')}</div>`
    : '';
  const packetLessHtml = packetLess ? `<div class="booked-rates"><div class="booked-line"><span>Packet note</span><b>${escapeHtml(packetLess)}</b></div></div>` : '';
  const labourHtml = labourSummary
    ? `<div class="receipt-group receipt-group-wide"><div class="receipt-title">Labour &amp; charges</div><div class="receipt-row"><span class="receipt-label">Total</span><span class="receipt-value">${escapeHtml(
        labourSummary,
      )}</span></div></div>`
    : '';
  const fineHtml = `<div class="receipt-group"><div class="receipt-title">Fine summary</div>${fineRows
    .map(
      (row) => `<div class="receipt-row"><span class="receipt-label">${escapeHtml(row.label)}</span><span class="receipt-value">${escapeHtml(row.value)}</span></div>`,
    )
    .join('')}</div>`;
  const moneyHtml = moneyRows.length
    ? `<div class="receipt-group"><div class="receipt-title">Receipt summary</div>${moneyRows
        .map(
          (row) => `<div class="receipt-row"><span class="receipt-label">${escapeHtml(row.label)}</span><span class="receipt-value">${escapeHtml(row.value)}</span></div>`,
        )
        .join('')}</div>`
    : '';
  return `<div class="receipt-grid">${fineHtml}${moneyHtml}${labourHtml}</div>${bookedRateHtml}${packetLessHtml}`;
}

function remainingBracketHtml(payload: BillPayload, transactions: BillTransaction[] = []) {
  const summary = billTransactionSummary(payload, transactions);
  const fineLabel = summary.fineAdvance > 0 ? t(payload.language, 'fineAdvance') : t(payload.language, 'fineRemain');
  const fineValue = `${formatPlainNumber(summary.fineAdvance > 0 ? summary.fineAdvance : summary.fineBalance)} gm`;
  const labourValue = formatBillMoney(summary.labourBalance, payload.autoRoundFigure);
  return `<section class="remain-bracket"><span>[ ${escapeHtml(fineLabel)}: ${escapeHtml(fineValue)} | ${escapeHtml(
    t(payload.language, 'labourRemain'),
  )}: ${escapeHtml(labourValue)} ]</span></section>`;
}

function buildEstimateBillHtml(payload: BillPayload, transactions: BillTransaction[] = []) {
  const language = payload.language;
  const summary = billTransactionSummary(payload, transactions);
  const rateCutSummaryAmount = summary.rateCutAmount;
  const cashReceivedSummaryAmount = summary.cashReceivedDisplay;
  const rateCutNotes = rateCutFooterNotes(payload, transactions);
  const tableRows = paddedEstimateRows(payload.items)
    .map((item) => {
      const materialLabel = t(language, 'silverRate');
      const translatedItem = item.itemName ? `${translateNameOrItem(item.itemName, language)} (${materialLabel})` : '';
      return `<tr>
        ${cell(translatedItem, 'item-cell')}
        ${cell(itemWeightDisplay(item), 'num-cell weight-cell')}
        ${cell(formatPlainNumber(item.touch), 'num-cell')}
        ${cell(formatPlainNumber(item.fine), 'num-cell')}
        ${cell(formatPlainNumber(item.pcs), 'num-cell')}
        ${cell(itemLabourDisplay(item), 'num-cell')}
        ${cell(item.other ? formatBillMoney(item.other, payload.autoRoundFigure) : '', 'num-cell')}
        ${cell(item.amount ? formatBillMoney(item.amount, payload.autoRoundFigure) : '', 'money-cell amount-cell')}
      </tr>`;
    })
    .join('') + estimateTotalRow(payload);

  return `<!doctype html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page {
          size: 660px 700px;
          margin: 0;
        }
        * { box-sizing: border-box; }
        html {
          height: 700px;
          margin: 0;
          overflow: hidden;
          padding: 0;
          width: 660px;
        }
        body {
          margin: 0;
          padding: 0;
          background: #fff;
          color: #5b1f2b;
          font-family: Arial, Helvetica, sans-serif;
          height: 700px;
          overflow: hidden;
          width: 660px;
        }
        .paper {
          background: #fffdf9;
          border: 1.2px solid #d5b9bd;
          display: grid;
          grid-template-rows: auto auto auto auto auto 1fr;
          height: 700px;
          margin: 0;
          min-height: 700px;
          overflow: hidden;
          padding: 18px 22px 16px;
          width: 660px;
          max-width: none;
        }
        @media screen {
          body {
            background: #f2efe8;
            padding: 0;
          }
          .paper {
            box-shadow: 0 1px 8px rgba(0, 0, 0, 0.08);
          }
        }
        @media print {
          html,
          body {
            -webkit-print-color-adjust: exact;
            height: 700px;
            margin: 0;
            overflow: hidden;
            padding: 0;
            print-color-adjust: exact;
            width: 660px;
          }
          .paper {
            break-inside: avoid;
            box-shadow: none;
            height: 700px;
            margin: 0;
            max-width: none;
            min-height: 700px;
            overflow: hidden;
            page-break-after: avoid;
            page-break-inside: avoid;
            width: 660px;
          }
        }
        .top {
          align-items: start;
          display: grid;
          gap: 3mm;
          grid-template-columns: 1fr 34mm 1fr;
        }
        .top-right {
          padding-top: 1mm;
          text-align: right;
        }
        .brand-center {
          align-items: center;
          display: flex;
          flex-direction: column;
          text-align: center;
        }
        .estimate {
          color: #9b2339;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 0;
          line-height: 1;
        }
        .shop-name {
          color: #7f2334;
          font-size: 13px;
          font-weight: 900;
          line-height: 1.2;
          margin-top: 1mm;
          text-transform: uppercase;
        }
        .owner-strip {
          color: #5b1f2b;
          display: flex;
          flex-wrap: wrap;
          font-size: 8.2px;
          font-weight: 900;
          gap: 0.8mm;
          line-height: 1.15;
          margin-top: 1mm;
        }
        .owner-sep {
          color: #a73a4a;
        }
        .shop-tagline {
          color: #7f2334;
          font-size: 7.6px;
          font-weight: 900;
          line-height: 1.15;
          margin-top: 0.3mm;
          text-transform: uppercase;
        }
        .address-block {
          color: #5b1f2b;
          font-size: 7.4px;
          font-weight: 800;
          line-height: 1.18;
          margin-top: 0.7mm;
          max-width: 62mm;
        }
        .owner-grid {
          display: grid;
          gap: 1.2mm;
          grid-template-columns: 1fr 1fr;
          margin-top: 1mm;
        }
        .owner-card {
          align-items: center;
          background: #fffaf3;
          border-bottom: 1px solid rgba(167, 58, 74, 0.55);
          border-top: 1px solid rgba(167, 58, 74, 0.55);
          display: flex;
          font-size: 7.8px;
          font-weight: 900;
          justify-content: space-between;
          min-height: 3.6mm;
          padding: 0.35mm 1.1mm;
        }
        .owner-card span {
          color: #7f2334;
        }
        .owner-card b {
          color: #4d1a23;
        }
        .address-strip {
          background: #6c1b18;
          color: #fff8e9;
          display: grid;
          font-size: 7.2px;
          font-weight: 800;
          gap: 0.15mm;
          line-height: 1.08;
          margin-top: 0.7mm;
          padding: 0.45mm 1.2mm;
        }
        .muted {
          font-size: 10px;
          font-weight: 800;
          line-height: 1.25;
        }
        .logo {
          align-items: center;
          align-self: center;
          background: #fffdf9;
          border: 1.4px solid #a73a4a;
          border-radius: 999px;
          color: #a73a4a;
          display: flex;
          font-family: Georgia, serif;
          font-size: 16px;
          font-weight: 900;
          height: 14mm;
          justify-content: center;
          letter-spacing: 0;
          width: 14mm;
        }
        .line-grid {
          display: grid;
          gap: 2mm 6mm;
          grid-template-columns: 1.1fr 1fr;
          margin: 2mm 0 2.3mm;
        }
        .line {
          border-bottom: 1.4px solid #a73a4a;
          font-size: 10.5px;
          font-weight: 700;
          min-height: 5.5mm;
          padding: 0.8mm 1mm 0.5mm;
          white-space: nowrap;
        }
        .line-full {
          grid-column: 1 / -1;
        }
        table {
          border-collapse: collapse;
          table-layout: fixed;
          margin: 0 auto;
          width: 100%;
        }
        th, td {
          border: 1.4px solid #a73a4a;
          color: #5b1f2b;
          text-align: center;
          vertical-align: middle;
        }
        th {
          font-size: 9px;
          font-weight: 900;
          height: 26px;
          line-height: 1.05;
          overflow-wrap: normal;
          padding: 1mm 0.8mm;
          word-break: keep-all;
        }
        td {
          font-size: 9.5px;
          font-weight: 700;
          height: 26px;
          line-height: 1.15;
          overflow-wrap: anywhere;
          padding: 1mm 0.8mm;
        }
        .item-col { width: 19%; }
        .weight-col { width: 14%; }
        .touch-col { width: 7%; }
        .fine-col { width: 12%; }
        .pcs-col { width: 5%; }
        .labour-col { width: 11%; }
        .other-col { width: 10%; }
        .amount-col { width: 22%; }
        .item-cell {
          text-align: left;
        }
        .num-cell,
        .money-cell {
          text-align: center;
        }
        .weight-cell {
          font-size: 8px;
          line-height: 1.05;
          white-space: pre-line;
        }
        .amount-cell {
          font-weight: 900;
        }
        .total-row td {
          background: #fff3f5;
          font-weight: 900;
        }
        .summary {
          align-items: flex-end;
          border: 1.2px solid #a73a4a;
          border-radius: 3px;
          background: #fff;
          display: flex;
          flex-direction: column;
          font-size: 9.2px;
          font-weight: 900;
          gap: 0.9mm;
          margin: 0;
          max-width: none;
          padding: 1.4mm 1.8mm;
          white-space: nowrap;
          width: 100%;
        }
        .summary-wrap {
          border: 1.4px solid #a73a4a;
          display: grid;
          gap: 0;
          grid-template-columns: minmax(0, 1fr) 60mm;
          justify-content: stretch;
          margin-top: 1.4mm;
          width: 100%;
        }
        .effect-line {
          color: #8a2638;
          font-size: 8.4px;
          font-weight: 900;
          margin-top: 0.8mm;
          text-align: left;
        }
        .summary-row {
          display: grid;
          gap: 1.5mm;
          grid-template-columns: 23mm minmax(0, 1fr);
          width: 100%;
        }
        .summary-label {
          color: #6f7770;
          text-align: left;
        }
        .summary-value {
          text-align: right;
        }
        .receipt {
          align-items: flex-start;
          color: #7c3642;
          display: block;
          font-size: 8.4px;
          font-weight: 900;
          margin-top: 0.4mm;
          text-align: left;
          flex: 1;
          border-right: 1.4px solid #a73a4a;
          min-width: 0;
          padding: 1.2mm 1.6mm;
        }
        .receipt-grid {
          display: grid;
          gap: 1mm;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .receipt-group {
          background: #fffaf8;
          border: 1px solid rgba(167, 58, 74, 0.42);
          border-radius: 1px;
          display: flex;
          flex-direction: column;
          gap: 0.4mm;
          min-width: 0;
          padding: 0.8mm 1mm;
          width: 100%;
        }
        .receipt-group-wide {
          grid-column: 1 / -1;
        }
        .receipt-title {
          color: #8a2638;
          font-size: 7.8px;
          text-transform: uppercase;
        }
        .receipt-row {
          align-items: center;
          display: grid;
          gap: 1mm;
          grid-template-columns: minmax(0, 1fr) auto;
          width: 100%;
        }
        .receipt-label {
          color: #7d6870;
          text-align: left;
        }
        .receipt-value {
          text-align: right;
        }
        .receipt span {
          display: block;
        }
        .booked-rates {
          border: 1px solid rgba(167, 58, 74, 0.42);
          background: #fffaf8;
          display: flex;
          flex-direction: column;
          gap: 0.3mm;
          margin-top: 1mm;
          padding: 0.7mm 1mm;
        }
        .booked-line {
          display: grid;
          gap: 1mm;
          grid-template-columns: 19mm minmax(0, 1fr);
        }
        .booked-line span {
          color: #7d6870;
        }
        .booked-line b {
          color: #5b1f2b;
          font-weight: 900;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .remain-bracket {
          align-items: center;
          color: #8f1f35;
          display: flex;
          font-size: 10.2px;
          font-weight: 900;
          justify-content: center;
          letter-spacing: 0;
          line-height: 1.2;
          margin-top: 1mm;
          text-align: center;
          text-transform: uppercase;
          white-space: nowrap;
          width: 100%;
        }
        .remain-bracket span {
          background: #fff3f5;
          border: 1.4px solid #a73a4a;
          border-radius: 2px;
          display: inline-block;
          padding: 1.1mm 3mm;
        }
        .footer {
          align-items: flex-end;
          break-inside: avoid;
          display: flex;
          justify-content: space-between;
          align-self: end;
          gap: 8mm;
          margin-top: 0;
          page-break-inside: avoid;
          padding-top: 0;
        }
        .footer-left {
          display: flex;
          flex-direction: column;
          gap: 1.4mm;
          width: 56%;
        }
        .terms {
          font-size: 9.4px;
          font-weight: 900;
          line-height: 1.22;
        }
        .signature {
          align-items: flex-end;
          display: flex;
          flex-direction: column;
          min-width: 40mm;
        }
        .signature-img {
          display: block;
          height: 17mm;
          margin-bottom: -2.5mm;
          object-fit: contain;
          width: 38mm;
        }
        .signature-line {
          border-bottom: 1.4px solid #a73a4a;
          font-size: 10px;
          font-weight: 800;
          padding-bottom: 0.8mm;
          text-align: left;
          width: 40mm;
        }
      </style>
    </head>
    <body>
      <main class="paper">
        <section class="top">
          <div>
            <div class="estimate">${escapeHtml(t(language, 'estimate'))}</div>
            <div class="muted">${escapeHtml(t(language, 'billNo'))} : ${payload.billNo}</div>
          </div>
          <div class="brand-center">
            ${logoHtml()}
            <div class="shop-name">${escapeHtml(SHOP.name)}</div>
            <div class="shop-tagline">${escapeHtml(SHOP.tagline)}</div>
          </div>
          <div class="muted top-right">${escapeHtml(t(language, 'date'))} : ${escapeHtml(formatDateForBill(payload.billDate))}</div>
        </section>
        ${ownerContactCardsHtml()}
        ${shopAddressHtml('address-strip')}

        <section class="line-grid">
          <div class="line">${escapeHtml(t(language, 'name'))} : ${escapeHtml(
            translateNameOrItem(payload.customer.name, language),
          )}</div>
          <div class="line">${escapeHtml(t(language, 'at'))} : ${escapeHtml(payload.customer.address)}</div>
          <div class="line line-full">${escapeHtml(t(language, 'mobile'))} : ${escapeHtml(payload.customer.mobile)}</div>
        </section>

        <table>
          <thead>
            <tr>
              <th class="item-col">${escapeHtml(t(language, 'item'))}</th>
              <th class="weight-col">${escapeHtml(t(language, 'weight'))}</th>
              <th class="touch-col">${escapeHtml(t(language, 'touch'))}</th>
              <th class="fine-col">${escapeHtml(t(language, 'fine'))}</th>
              <th class="pcs-col">${escapeHtml(t(language, 'pcs'))}</th>
              <th class="labour-col">${escapeHtml(t(language, 'labour'))}</th>
              <th class="other-col">Other</th>
              <th class="amount-col">${escapeHtml(t(language, 'amount'))}</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>

        <section class="summary-wrap">
          <div class="receipt">${receiptSummaryHtml(payload, transactions)}</div>
          <div class="summary">
            <div class="summary-row">
              <span class="summary-label">${escapeHtml(t(language, 'labourTotal'))}</span>
              <span class="summary-value">${escapeHtml(formatBillMoney(payload.subtotal, payload.autoRoundFigure))}</span>
            </div>
            ${
              rateCutSummaryAmount > 0
                ? `<div class="summary-row">
                    <span class="summary-label">Rate cut amount</span>
                    <span class="summary-value">${escapeHtml(formatBillMoney(rateCutSummaryAmount, payload.autoRoundFigure))}</span>
                  </div>`
                : ''
            }
            <div class="summary-row">
              <span class="summary-label">Cash rec</span>
              <span class="summary-value">${escapeHtml(formatBillMoney(cashReceivedSummaryAmount, payload.autoRoundFigure))}</span>
            </div>
            ${
              summary.discountAmount > 0
                ? `<div class="summary-row">
                    <span class="summary-label">Discount</span>
                    <span class="summary-value">${escapeHtml(formatBillMoney(summary.discountAmount, payload.autoRoundFigure))}</span>
                  </div>`
                : ''
            }
            <div class="summary-row">
              <span class="summary-label">Amount due</span>
              <span class="summary-value">${escapeHtml(formatBillMoney(summary.billLabourBalance, payload.autoRoundFigure))}</span>
            </div>
            ${rateCutNotes.length ? `<div class="effect-line">${rateCutNotes.map((note) => `<div>${escapeHtml(note)}</div>`).join('')}</div>` : ''}
          </div>
        </section>

        ${remainingBracketHtml(payload, transactions)}

        <section class="footer">
          <div class="footer-left">
            <div class="terms">
              ${escapeHtml(t(language, 'reportLine1'))}<br />
              ${escapeHtml(t(language, 'reportLine2'))}
            </div>
          </div>
          ${signatureHtml(t(language, 'signature'))}
        </section>
      </main>
    </body>
  </html>`;
}

function translatedCustomerName(payload: BillPayload) {
  return translateNameOrItem(payload.customer.name, payload.language);
}

function buildWholesaleRows(payload: BillPayload) {
  return visibleItems(payload.items)
    .map((item, index) => {
      const materialLabel = t(payload.language, 'silverRate');
      const translatedItem = `${translateNameOrItem(item.itemName, payload.language)} (${materialLabel})`;
      return `<tr>
        ${cell(String(index + 1), 'center')}
        ${cell(translatedItem, 'left')}
        ${cell(itemWeightDisplay(item), 'right weight-cell')}
        ${cell(formatPlainNumber(item.touch), 'right')}
        ${cell(formatPlainNumber(item.fine), 'right')}
        ${cell(formatPlainNumber(item.pcs), 'right')}
        ${cell(itemLabourDisplay(item), 'right')}
        ${cell(item.other ? formatBillMoney(item.other, payload.autoRoundFigure) : '', 'right')}
        ${cell(item.amount ? formatBillMoney(item.amount, payload.autoRoundFigure) : '', 'right strong')}
      </tr>`;
    })
    .join('');
}

function buildWholesaleBillHtml(payload: BillPayload, transactions: BillTransaction[] = []) {
  const language: Language = payload.language;
  const summary = billTransactionSummary(payload, transactions);
  const rateCutSummaryAmount = summary.rateCutAmount;
  const cashReceivedSummaryAmount = summary.cashReceivedDisplay;
  const rateCutNotes = rateCutFooterNotes(payload, transactions);

  return `<!doctype html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 24px;
          background: #edf0ee;
          color: #1f2421;
          font-family: Arial, Helvetica, sans-serif;
        }
        .invoice {
          width: 720px;
          min-height: 900px;
          margin: 0 auto;
          background: #fff;
          border: 1px solid #d9dedb;
        }
        .header {
          align-items: center;
          background: #23362f;
          color: #fff;
          display: flex;
          gap: 18px;
          padding: 24px 28px;
        }
        .logo-pro {
          align-items: center;
          background: #d5a642;
          border-radius: 50%;
          color: #21170a;
          display: flex;
          flex-shrink: 0;
          font-family: Georgia, serif;
          font-size: 25px;
          font-weight: 900;
          height: 68px;
          justify-content: center;
          width: 68px;
        }
        .shop h1 {
          font-size: 30px;
          line-height: 34px;
          margin: 0;
          text-transform: uppercase;
        }
        .shop p {
          color: #e6dfd1;
          font-size: 13px;
          font-weight: 700;
          margin: 5px 0 0;
        }
        .shop .owner-strip {
          color: #fff3dd;
          display: flex;
          flex-wrap: wrap;
          font-size: 12px;
          font-weight: 900;
          gap: 8px;
          line-height: 17px;
          margin-top: 6px;
        }
        .shop .owner-sep {
          color: #d5a642;
        }
        .shop .address-block {
          color: #f3ead6;
          font-size: 11px;
          font-weight: 700;
          line-height: 16px;
          margin-top: 5px;
        }
        .content { padding: 24px 28px; }
        .meta-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr 1fr;
          margin-bottom: 18px;
        }
        .box {
          border: 1px solid #d9dedb;
          border-radius: 8px;
          padding: 14px;
        }
        .box-title {
          color: #64706a;
          font-size: 11px;
          font-weight: 900;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .line {
          display: flex;
          font-size: 13px;
          justify-content: space-between;
          line-height: 21px;
        }
        .label { color: #68736e; font-weight: 800; }
        .value { color: #1f2421; font-weight: 800; text-align: right; }
        table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
        }
        th {
          background: #f2eadb;
          border-bottom: 1px solid #d7c9aa;
          color: #594214;
          font-size: 11px;
          padding: 10px 6px;
          text-transform: uppercase;
        }
        td {
          border-bottom: 1px solid #edf0ee;
          color: #252a27;
          font-size: 12px;
          padding: 10px 6px;
          vertical-align: top;
        }
        .left { text-align: left; }
        .center { text-align: center; }
        .right { text-align: right; }
        .weight-cell {
          line-height: 1.2;
          white-space: pre-line;
        }
        .strong { font-weight: 900; }
        .totals {
          align-items: flex-end;
          display: flex;
          flex-direction: column;
          margin-top: 18px;
        }
        .total-row {
          align-items: center;
          display: flex;
          font-weight: 900;
          justify-content: space-between;
          min-width: 280px;
          padding: 8px 0;
        }
        .total-row.net {
          background: #23362f;
          border-radius: 8px;
          color: #fff;
          margin-top: 6px;
          padding: 13px 16px;
        }
        .receipt {
          color: #5d6963;
          font-size: 12px;
          font-weight: 800;
          max-width: 330px;
          text-align: right;
        }
        .booked-rates {
          border-top: 1px solid #dde5e0;
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 8px;
          padding-top: 8px;
        }
        .remain-bracket {
          color: #8f1f35;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0;
          line-height: 20px;
          margin: 22px auto 0;
          text-align: center;
          text-transform: uppercase;
          width: 100%;
        }
        .remain-bracket span {
          display: inline-block;
          padding: 0 14px;
        }
        .footer {
          align-items: flex-end;
          display: flex;
          gap: 24px;
          justify-content: space-between;
          margin-top: 34px;
        }
        .footer-left {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .terms {
          color: #5d6963;
          font-size: 12px;
          font-weight: 700;
          line-height: 18px;
          max-width: 390px;
        }
        .signature {
          align-items: center;
          display: flex;
          flex-direction: column;
          width: 190px;
        }
        .signature-img {
          display: block;
          height: 70px;
          margin-bottom: -9px;
          object-fit: contain;
          width: 150px;
        }
        .signature-line {
          border-top: 1px solid #1f2421;
          font-size: 13px;
          font-weight: 800;
          padding-top: 8px;
          text-align: center;
          width: 190px;
        }
      </style>
    </head>
    <body>
      <main class="invoice">
        <section class="header">
          ${logoHtml('logo-pro')}
          <div class="shop">
            <h1>${escapeHtml(SHOP.name)}</h1>
            <p>${escapeHtml(SHOP.tagline)}</p>
            ${ownerContactsHtml()}
            ${shopAddressHtml()}
          </div>
        </section>

        <section class="content">
          <div class="meta-grid">
            <div class="box">
              <div class="box-title">${escapeHtml(t(language, 'customer'))}</div>
              <div class="line"><span class="label">${escapeHtml(t(language, 'name'))}</span><span class="value">${escapeHtml(
                translatedCustomerName(payload),
              )}</span></div>
              <div class="line"><span class="label">${escapeHtml(t(language, 'mobile'))}</span><span class="value">${escapeHtml(
                payload.customer.mobile,
              )}</span></div>
              <div class="line"><span class="label">${escapeHtml(t(language, 'address'))}</span><span class="value">${escapeHtml(
                payload.customer.address,
              )}</span></div>
            </div>
            <div class="box">
              <div class="box-title">${escapeHtml(t(language, 'wholesaleBill'))}</div>
              <div class="line"><span class="label">${escapeHtml(t(language, 'billNo'))}</span><span class="value">${
                payload.billNo
              }</span></div>
              <div class="line"><span class="label">${escapeHtml(t(language, 'date'))}</span><span class="value">${escapeHtml(
                formatDateForBill(payload.billDate),
              )}</span></div>
              <div class="line"><span class="label">${escapeHtml(t(language, 'language'))}</span><span class="value">${escapeHtml(
                language.toUpperCase(),
              )}</span></div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 6%;">#</th>
                <th style="width: 22%; text-align: left;">${escapeHtml(t(language, 'item'))}</th>
                <th style="width: 12%;">${escapeHtml(t(language, 'weight'))}</th>
                <th style="width: 8%;">${escapeHtml(t(language, 'touch'))}</th>
                <th style="width: 11%;">${escapeHtml(t(language, 'fine'))}</th>
                <th style="width: 6%;">${escapeHtml(t(language, 'pcs'))}</th>
                <th style="width: 11%;">${escapeHtml(t(language, 'labour'))}</th>
                <th style="width: 10%;">Other</th>
                <th style="width: 14%;">${escapeHtml(t(language, 'amount'))}</th>
              </tr>
            </thead>
            <tbody>${buildWholesaleRows(payload)}</tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>${escapeHtml(t(language, 'labourTotal'))}</span>
              <span>${escapeHtml(formatBillMoney(payload.subtotal, payload.autoRoundFigure))}</span>
            </div>
            ${
              rateCutSummaryAmount > 0
                ? `<div class="total-row">
                    <span>Rate cut amount</span>
                    <span>${escapeHtml(formatBillMoney(rateCutSummaryAmount, payload.autoRoundFigure))}</span>
                  </div>`
                : ''
            }
            <div class="total-row">
              <span>Cash rec</span>
              <span>${escapeHtml(formatBillMoney(cashReceivedSummaryAmount, payload.autoRoundFigure))}</span>
            </div>
            ${
              summary.discountAmount > 0
                ? `<div class="total-row">
                    <span>Discount</span>
                    <span>${escapeHtml(formatBillMoney(summary.discountAmount, payload.autoRoundFigure))}</span>
                  </div>`
                : ''
            }
            <div class="receipt">${receiptSummaryHtml(payload, transactions)}</div>
            <div class="total-row net">
              <span>Amount due</span>
              <span>${escapeHtml(formatBillMoney(summary.billLabourBalance, payload.autoRoundFigure))}</span>
            </div>
            ${rateCutNotes.length ? `<div class="effect-line">${rateCutNotes.map((note) => `<div>${escapeHtml(note)}</div>`).join('')}</div>` : ''}
          </div>

          ${remainingBracketHtml(payload, transactions)}

          <section class="footer">
            <div class="footer-left">
              <div class="terms">
                ${escapeHtml(t(language, 'reportLine1'))}<br />
                ${escapeHtml(t(language, 'reportLine2'))}
              </div>
            </div>
            ${signatureHtml(SHOP.name)}
          </section>
        </section>
      </main>
    </body>
  </html>`;
}

function buildJangadBillHtml(payload: BillPayload, transactions: BillTransaction[] = []) {
  const language = payload.language;
  const visible = visibleItems(payload.items);
  const pcsTotal = visible.reduce((s, i) => s + parseAmount(i.pcs), 0);
  const weightTotal = roundWeight(visible.reduce((s, i) => s + Math.max(parseAmount(i.weight) - parseAmount(i.packetLess), 0), 0));
  const tableRows = paddedEstimateRows(payload.items)
    .map((item) => {
      const translatedItem = item.itemName ? translateNameOrItem(item.itemName, language) : '';
      return `<tr>
        ${cell(translatedItem, 'item-cell')}
        ${cell(formatPlainNumber(item.pcs), 'num-cell')}
        ${cell(itemWeightDisplay(item), 'num-cell weight-cell')}
      </tr>`;
    })
    .join('') +
    `<tr class="total-row">
      ${cell('Total', 'item-cell')}
      ${cell(formatPlainNumber(pcsTotal), 'num-cell')}
      ${cell(formatCalcValue(weightTotal, 3), 'num-cell weight-cell')}
    </tr>`;

  return `<!doctype html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { size: 660px 700px; margin: 0; }
        * { box-sizing: border-box; }
        html { height: 700px; margin: 0; overflow: hidden; padding: 0; width: 660px; }
        body { margin: 0; padding: 0; background: #fff; color: #5b1f2b; font-family: Arial, Helvetica, sans-serif; height: 700px; overflow: hidden; width: 660px; }
        .paper { background: #fffdf9; border: 1.2px solid #d5b9bd; display: flex; flex-direction: column; height: 700px; margin: 0; min-height: 700px; overflow: hidden; padding: 18px 22px 16px; width: 660px; max-width: none; }
        @media screen { body { background: #f2efe8; padding: 0; } .paper { box-shadow: 0 1px 8px rgba(0, 0, 0, 0.08); } }
        @media print { html, body { -webkit-print-color-adjust: exact; height: 700px; margin: 0; overflow: hidden; padding: 0; print-color-adjust: exact; width: 660px; } .paper { break-inside: avoid; box-shadow: none; height: 700px; margin: 0; max-width: none; min-height: 700px; } }
        .top { align-items: start; display: grid; gap: 3mm; grid-template-columns: 1fr 34mm 1fr; }
        .top-right { padding-top: 1mm; text-align: right; }
        .brand-center { align-items: center; display: flex; flex-direction: column; text-align: center; }
        .estimate { color: #9b2339; font-size: 18px; font-weight: 900; letter-spacing: 0; line-height: 1; }
        .shop-name { color: #7f2334; font-size: 13px; font-weight: 900; line-height: 1.2; margin-top: 1mm; text-transform: uppercase; }
        .owner-strip { color: #5b1f2b; display: flex; flex-wrap: wrap; font-size: 8.2px; font-weight: 900; gap: 0.8mm; line-height: 1.15; margin-top: 1mm; }
        .owner-sep { color: #a73a4a; }
        .shop-tagline { color: #7f2334; font-size: 7.6px; font-weight: 900; line-height: 1.15; margin-top: 0.3mm; text-transform: uppercase; }
        .address-block { color: #5b1f2b; font-size: 7.4px; font-weight: 800; line-height: 1.18; margin-top: 0.7mm; max-width: 62mm; }
        .owner-grid { display: grid; gap: 1.2mm; grid-template-columns: 1fr 1fr; margin-top: 1mm; }
        .owner-card { align-items: center; background: #fffaf3; border-bottom: 1px solid rgba(167, 58, 74, 0.55); border-top: 1px solid rgba(167, 58, 74, 0.55); display: flex; font-size: 7.8px; font-weight: 900; justify-content: space-between; min-height: 3.6mm; padding: 0.35mm 1.1mm; }
        .owner-card span { color: #7f2334; }
        .owner-card b { color: #4d1a23; }
        .address-strip { background: #6c1b18; color: #fff8e9; display: grid; font-size: 7.2px; font-weight: 800; gap: 0.15mm; line-height: 1.08; margin-top: 0.7mm; padding: 0.45mm 1.2mm; }
        .muted { font-size: 10px; font-weight: 800; line-height: 1.25; }
        .logo { align-items: center; align-self: center; background: #fffdf9; border: 1.4px solid #a73a4a; border-radius: 999px; color: #a73a4a; display: flex; font-family: Georgia, serif; font-size: 16px; font-weight: 900; height: 14mm; justify-content: center; letter-spacing: 0; width: 14mm; }
        .line-grid { display: grid; gap: 2mm 6mm; grid-template-columns: 1.1fr 1fr; margin: 2mm 0 2.3mm; }
        .line { border-bottom: 1.4px solid #a73a4a; font-size: 10.5px; font-weight: 700; min-height: 5.5mm; padding: 0.8mm 1mm 0.5mm; white-space: nowrap; }
        .line-full { grid-column: 1 / -1; }
        table { border-collapse: collapse; table-layout: fixed; margin: 0 auto; width: 100%; }
        th, td { border: 1.4px solid #a73a4a; color: #5b1f2b; text-align: center; vertical-align: middle; }
        th { font-size: 9px; font-weight: 900; height: 26px; line-height: 1.05; overflow-wrap: normal; padding: 1mm 0.8mm; word-break: keep-all; }
        td { font-size: 9.5px; font-weight: 700; height: 26px; line-height: 1.15; overflow-wrap: anywhere; padding: 1mm 0.8mm; }
        .item-col { width: 50%; }
        .weight-col { width: 30%; }
        .pcs-col { width: 20%; }
        .item-cell { text-align: left; }
        .num-cell { text-align: center; }
        .weight-cell { text-align: right; }
        .total-row td { background: #fff3f5; font-weight: 900; }
        .note-text { color: #7d3c45; font-size: 9.5px; font-style: italic; font-weight: 800; }
        .footer { display: flex; flex-direction: column; gap: 1.4mm; margin-top: auto; }
        .footer-row { display: flex; justify-content: space-between; }
        .footer-left { display: flex; flex-direction: column; gap: 1.4mm; width: 56%; }
        .footer-right { align-items: flex-end; display: flex; flex-direction: column; }
        .terms { font-size: 9.4px; font-weight: 900; line-height: 1.22; }
        .signature { align-items: flex-end; display: flex; flex-direction: column; min-width: 40mm; }
        .signature-img { display: block; height: 17mm; margin-bottom: -2.5mm; object-fit: contain; width: 38mm; }
        .signature-line { border-bottom: 1.4px solid #a73a4a; font-size: 10px; font-weight: 800; padding-bottom: 0.8mm; text-align: left; width: 40mm; }
      </style>
    </head>
    <body>
      <main class="paper">
        <section class="top">
          <div>
            <div class="estimate">${escapeHtml(t(language, 'jangadBill'))}</div>
            <div class="muted">${escapeHtml(t(language, 'billNo'))} : ${payload.billNo}</div>
          </div>
          <div class="brand-center">
            ${logoHtml()}
            <div class="shop-name">${escapeHtml(SHOP.name)}</div>
            <div class="shop-tagline">${escapeHtml(SHOP.tagline)}</div>
          </div>
          <div class="muted top-right">${escapeHtml(t(language, 'date'))} : ${escapeHtml(formatDateForBill(payload.billDate))}</div>
        </section>
        ${ownerContactCardsHtml()}
        ${shopAddressHtml('address-strip')}

        <section class="line-grid">
          <div class="line">${escapeHtml(t(language, 'name'))} : ${escapeHtml(translateNameOrItem(payload.customer.name, language))}</div>
          <div class="line">${escapeHtml(t(language, 'at'))} : ${escapeHtml(payload.customer.address)}</div>
          <div class="line line-full">${escapeHtml(t(language, 'mobile'))} : ${escapeHtml(payload.customer.mobile)}</div>
        </section>

        <table>
          <thead>
            <tr>
              <th class="item-col">${escapeHtml(t(language, 'item'))}</th>
              <th class="pcs-col">${escapeHtml(t(language, 'pcs'))}</th>
              <th class="weight-col">${escapeHtml(t(language, 'weight'))}</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>

        <section class="footer">
          <div class="footer-row">
            <div class="footer-left">
              <div class="terms">${escapeHtml(t(language, 'reportLine1'))}<br />${escapeHtml(t(language, 'reportLine2'))}</div>
            </div>
            <div class="footer-right">
              ${signatureHtml(t(language, 'signature'))}
            </div>
          </div>
          ${payload.note ? `<div class="note-text">${escapeHtml(payload.note)}</div>` : ''}
        </section>
      </main>
    </body>
  </html>`;
}

export function buildBillHtml(payload: BillPayload, transactions: BillTransaction[] = []) {
  return payload.billType === 'jangad'
    ? buildJangadBillHtml(payload, transactions)
    : buildEstimateBillHtml(payload, transactions);
}
