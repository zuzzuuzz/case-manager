/**
 * VélourCare Ortho — Interactive IPR Management Engine
 * Handles contact point selection, stage timing, mm reduction presets, and live anatomical arch updates.
 */

const IprChart = (() => {
    let currentCaseData = null;
    let activeModalContact = null;
    let activeModalArch = null;

    function init({ upperContainer, lowerContainer, summaryContainer, caseData, onUpdate }) {
        currentCaseData = caseData;

        function refreshArches() {
            ToothChart.renderArch({
                container: upperContainer,
                isLower: false,
                iprData: currentCaseData.upper_ipr || {},
                attachments: currentCaseData.attachments || {},
                onIprClick: handleIprClick
            });

            ToothChart.renderArch({
                container: lowerContainer,
                isLower: true,
                iprData: currentCaseData.lower_ipr || {},
                attachments: currentCaseData.attachments || {},
                onIprClick: handleIprClick
            });

            renderIprSummary(summaryContainer);
        }

        function handleIprClick({ contact, arch, existing }) {
            openIprModal(contact, arch, existing, currentCaseData);
        }

        refreshArches();

        return {
            refresh: refreshArches,
            getData: () => ({
                upper_ipr: currentCaseData.upper_ipr,
                lower_ipr: currentCaseData.lower_ipr
            })
        };
    }

    function renderIprSummary(container) {
        if (!container || !currentCaseData) return;

        const upper = currentCaseData.upper_ipr || {};
        const lower = currentCaseData.lower_ipr || {};

        let html = `
            <div class="ipr-summary-blocks">
                <h4 style="font-family:var(--font-display); margin-bottom:12px; color:var(--color-slate-900);">Active IPR Protocols</h4>
                <div class="ipr-details-grid">
        `;

        let count = 0;

        // Upper
        Object.keys(upper).forEach(key => {
            const item = upper[key];
            if (item && parseFloat(item.amount) > 0) {
                count++;
                html += `
                    <div class="ipr-item-card">
                        <div>
                            <span class="ipr-item-teeth">Upper ${key}</span>
                            <div class="ipr-item-stage">${item.stage || 'Stage 1'}</div>
                        </div>
                        <div class="ipr-item-values">
                            <span class="ipr-item-mm">${item.amount} mm</span>
                        </div>
                    </div>
                `;
            }
        });

        // Lower
        Object.keys(lower).forEach(key => {
            const item = lower[key];
            if (item && parseFloat(item.amount) > 0) {
                count++;
                html += `
                    <div class="ipr-item-card">
                        <div>
                            <span class="ipr-item-teeth">Lower ${key}</span>
                            <div class="ipr-item-stage">${item.stage || 'Stage 1'}</div>
                        </div>
                        <div class="ipr-item-values">
                            <span class="ipr-item-mm">${item.amount} mm</span>
                        </div>
                    </div>
                `;
            }
        });

        if (count === 0) {
            html += `<p style="font-size:0.85rem; color:var(--text-muted); grid-column: 1 / -1;">No interproximal reduction (IPR) configured. Click any '+' marker between teeth above to assign IPR.</p>`;
        }

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    function updatePresetButtons(val) {
        const numVal = parseFloat(val);
        document.querySelectorAll('.ipr-preset-btn').forEach(btn => {
            const btnVal = parseFloat(btn.getAttribute('data-mm'));
            if (btnVal === numVal) {
                btn.classList.add('active');
                btn.style.background = 'var(--color-brand-600)';
                btn.style.color = '#FFFFFF';
            } else {
                btn.classList.remove('active');
                btn.style.background = '';
                btn.style.color = '';
            }
        });
    }

    function updateStagePresetButtons(stageVal) {
        document.querySelectorAll('.ipr-stage-preset-btn').forEach(btn => {
            const btnStage = btn.getAttribute('data-stage');
            if (btnStage === stageVal) {
                btn.classList.add('active');
                btn.style.background = 'var(--color-brand-600)';
                btn.style.color = '#FFFFFF';
            } else {
                btn.classList.remove('active');
                btn.style.background = '';
                btn.style.color = '';
            }
        });
    }

    function openIprModal(contact, arch, existing, caseData) {
        activeModalContact = contact;
        activeModalArch = arch;
        if (caseData) {
            currentCaseData = caseData;
        }

        const modal = document.getElementById('ipr-modal');
        if (!modal) return;

        const titleEl = document.getElementById('ipr-modal-contact-title');
        const amountInput = document.getElementById('ipr-modal-amount');
        const stageSelect = document.getElementById('ipr-modal-stage');

        const [t1, t2] = contact.split('-');
        const palmer1 = typeof ToothChart !== 'undefined' ? ToothChart.getPalmerNumber(parseInt(t1, 10)) : t1;
        const palmer2 = typeof ToothChart !== 'undefined' ? ToothChart.getPalmerNumber(parseInt(t2, 10)) : t2;

        titleEl.textContent = `${arch === 'upper' ? 'Upper Arch' : 'Lower Arch'} — Contact #${contact} (Palmer ${palmer1} / ${palmer2})`;
        
        const existingAmount = existing && existing.amount !== undefined ? parseFloat(existing.amount) : 0.2;
        amountInput.value = isNaN(existingAmount) ? 0.2 : existingAmount;
        stageSelect.value = existing && existing.stage ? existing.stage : 'Before Tray 1';

        updatePresetButtons(amountInput.value);
        updateStagePresetButtons(stageSelect.value);

        modal.classList.add('open');
    }

    function closeIprModal() {
        const modal = document.getElementById('ipr-modal');
        if (modal) modal.classList.remove('open');
        activeModalContact = null;
        activeModalArch = null;
    }

    function saveIprFromModal(onUpdateCallback, fallbackCaseData) {
        const c = fallbackCaseData || currentCaseData;
        if (!c) {
            console.error('IprChart: No case data available to save IPR');
            return;
        }

        if (!activeModalContact || !activeModalArch) {
            console.warn('IprChart: No active contact/arch specified to save');
            closeIprModal();
            return;
        }

        c.upper_ipr = c.upper_ipr || {};
        c.lower_ipr = c.lower_ipr || {};

        const amountInput = document.getElementById('ipr-modal-amount');
        const stageSelect = document.getElementById('ipr-modal-stage');

        const amount = parseFloat(amountInput.value);
        const stage = stageSelect ? stageSelect.value : 'Stage 1';

        const targetDict = activeModalArch === 'upper' ? c.upper_ipr : c.lower_ipr;

        if (isNaN(amount) || amount <= 0) {
            delete targetDict[activeModalContact];
        } else {
            targetDict[activeModalContact] = {
                amount: Math.round(amount * 100) / 100,
                stage: stage
            };
        }

        closeIprModal();
        if (typeof onUpdateCallback === 'function') {
            onUpdateCallback(c);
        }
    }

    function clearIprFromModal(onUpdateCallback, fallbackCaseData) {
        const c = fallbackCaseData || currentCaseData;
        if (c && activeModalContact && activeModalArch) {
            const targetDict = activeModalArch === 'upper' ? (c.upper_ipr || {}) : (c.lower_ipr || {});
            delete targetDict[activeModalContact];
        }
        closeIprModal();
        if (typeof onUpdateCallback === 'function') {
            onUpdateCallback(c);
        }
    }

    function setCaseData(caseData) {
        currentCaseData = caseData;
    }

    return {
        init,
        setCaseData,
        openIprModal,
        closeIprModal,
        saveIprFromModal,
        clearIprFromModal,
        updatePresetButtons,
        updateStagePresetButtons,
        renderIprSummary
    };
})();

window.IprChart = IprChart;
