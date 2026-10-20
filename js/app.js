/**
 * VélourCare Ortho — Clinical Case Report Manager Main Application
 * Coordinates SPA views, REST API calls, wizard steps, and real-time dental charts.
 */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // App State
    // -------------------------------------------------------------------------
    let cases = [];
    let activeCase = null;
    let activeFilter = 'all';
    let searchQuery = '';
    let currentStep = 1;

    let iprEngine = null;

    // -------------------------------------------------------------------------
    // DOM Elements
    // -------------------------------------------------------------------------
    const viewDashboard = document.getElementById('view-dashboard');
    const viewEditor = document.getElementById('view-editor');
    const viewReport = document.getElementById('view-report');

    const casesGrid = document.getElementById('cases-grid-container');
    const searchInput = document.getElementById('dashboard-search');
    const filterPills = document.querySelectorAll('.filter-pill');

    const statTotal = document.getElementById('stat-total-cases');
    const statComplete = document.getElementById('stat-complete-cases');
    const statDraft = document.getElementById('stat-draft-cases');
    const statAligners = document.getElementById('stat-total-aligners');

    // Header buttons
    document.getElementById('nav-brand-home').addEventListener('click', () => showView('dashboard'));
    document.getElementById('btn-header-dashboard').addEventListener('click', () => showView('dashboard'));
    document.getElementById('btn-header-new').addEventListener('click', startNewCase);
    document.getElementById('btn-dashboard-new').addEventListener('click', startNewCase);

    // Editor actions
    document.getElementById('btn-editor-cancel').addEventListener('click', () => showView('dashboard'));
    document.getElementById('btn-editor-save').addEventListener('click', saveCurrentCase);
    document.getElementById('btn-editor-preview-pdf').addEventListener('click', previewPdfReport);

    // Report actions
    document.getElementById('btn-report-back').addEventListener('click', () => showView('editor'));
    document.getElementById('btn-report-print').addEventListener('click', () => PdfExport.triggerPrint());

    // -------------------------------------------------------------------------
    // View Switcher
    // -------------------------------------------------------------------------
    function showView(viewName) {
        viewDashboard.classList.remove('active');
        viewEditor.classList.remove('active');
        viewReport.classList.remove('active');

        if (viewName === 'dashboard') {
            viewDashboard.classList.add('active');
            loadCases();
        } else if (viewName === 'editor') {
            viewEditor.classList.add('active');
        } else if (viewName === 'report') {
            viewReport.classList.add('active');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // -------------------------------------------------------------------------
    // Toast System
    // -------------------------------------------------------------------------
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<span>✨</span> <div>${message}</div>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    // -------------------------------------------------------------------------
    // Tunnel Status Poller
    // -------------------------------------------------------------------------
    async function checkTunnelStatus() {
        try {
            const res = await fetch('/api/tunnel-url');
            if (res.ok) {
                const data = await res.json();
                const dot = document.getElementById('tunnel-dot');
                const label = document.getElementById('tunnel-label');
                const badge = document.getElementById('tunnel-badge');

                if (data.url) {
                    dot.className = 'tunnel-dot';
                    label.textContent = 'Team HTTPS Live';
                    badge.title = `Click to copy team URL: ${data.url}`;
                    badge.onclick = () => {
                        navigator.clipboard.writeText(data.url);
                        showToast(`Copied live team link: ${data.url}`);
                    };
                } else {
                    dot.className = 'tunnel-dot connecting';
                    label.textContent = 'Local Mode';
                }
            }
        } catch (e) {
            // quiet poll error
        }
    }
    setInterval(checkTunnelStatus, 8000);
    checkTunnelStatus();

    // -------------------------------------------------------------------------
    // Dashboard: Fetch & Render Cases
    // -------------------------------------------------------------------------
    async function loadCases() {
        try {
            const res = await fetch('/api/cases');
            if (!res.ok) throw new Error("Could not load cases");
            const data = await res.json();
            cases = data.cases || [];
            updateStats();
            renderCasesGrid();
        } catch (e) {
            showToast("Failed to load cases: " + e.message, "error");
        }
    }

    function updateStats() {
        const total = cases.length;
        const complete = cases.filter(c => c.status === 'complete').length;
        const draft = cases.filter(c => c.status === 'draft').length;
        const totalAligners = cases.reduce((acc, c) => acc + (parseInt(c.upper_aligners || 0) + parseInt(c.lower_aligners || 0)), 0);

        statTotal.textContent = total;
        statComplete.textContent = complete;
        statDraft.textContent = draft;
        statAligners.textContent = totalAligners;
    }

    function renderCasesGrid() {
        let filtered = cases.filter(c => {
            if (activeFilter !== 'all' && c.status !== activeFilter) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const num = (c.case_number || '').toLowerCase();
                const pat = (c.patient_name || '').toLowerCase();
                const cli = (c.clinic_name || '').toLowerCase();
                return num.includes(q) || pat.includes(q) || cli.includes(q);
            }
            return true;
        });

        if (filtered.length === 0) {
            casesGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding:50px 20px; background:#fff; border-radius:12px; border:1px solid var(--border-color);">
                    <div style="font-size:2.5rem; margin-bottom:10px;">📋</div>
                    <h3 style="font-family:var(--font-display); color:var(--color-slate-800);">No cases found</h3>
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">Try modifying your search or create a new clear aligner case.</p>
                </div>
            `;
            return;
        }

        casesGrid.innerHTML = filtered.map(c => `
            <div class="case-card" data-id="${c.id}">
                <div>
                    <div class="case-card-header">
                        <span class="case-card-num">${c.case_number || 'WA-000'}</span>
                        <span class="case-status-badge ${c.status}">${c.status === 'complete' ? '✓ Complete' : '● Draft'}</span>
                    </div>
                    <div class="case-card-patient">${c.patient_name || 'Unnamed Patient'}</div>
                    <div class="case-card-clinic">${c.clinic_name || 'Unassigned Clinic'}</div>
                    
                    <div class="case-aligner-metrics">
                        <div class="metric-col">
                            <span>Upper Aligners</span>
                            <span># ${c.upper_aligners || 0}</span>
                        </div>
                        <div class="metric-col">
                            <span>Lower Aligners</span>
                            <span># ${c.lower_aligners || 0}</span>
                        </div>
                    </div>
                </div>

                <div class="case-card-footer">
                    <span class="case-card-date">${c.case_date || ''}</span>
                    <div class="case-card-btns">
                        <button class="btn btn-secondary btn-sm btn-action-report" data-id="${c.id}" title="View 3-Page Printable PDF">📄 PDF</button>
                        <button class="btn btn-primary btn-sm btn-action-edit" data-id="${c.id}">Edit</button>
                        <button class="btn btn-danger btn-sm btn-action-delete" data-id="${c.id}" title="Delete Case">✕</button>
                    </div>
                </div>
            </div>
        `).join('');

        // Card button events
        casesGrid.querySelectorAll('.btn-action-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                editCaseById(id);
            });
        });

        casesGrid.querySelectorAll('.btn-action-report').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const target = cases.find(c => String(c.id) === String(id));
                if (target) {
                    activeCase = target;
                    previewPdfReport();
                }
            });
        });

        casesGrid.querySelectorAll('.btn-action-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const target = cases.find(c => String(c.id) === String(id));
                if (confirm(`Are you sure you want to delete case ${target ? target.case_number : ''}?`)) {
                    await deleteCase(id);
                }
            });
        });
    }

    // Search and Filter Listeners
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderCasesGrid();
    });

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeFilter = pill.getAttribute('data-filter');
            renderCasesGrid();
        });
    });

    // -------------------------------------------------------------------------
    // Wizard Steps Navigation
    // -------------------------------------------------------------------------
    const wizardTabs = document.querySelectorAll('.wizard-tab');
    const wizardSteps = document.querySelectorAll('.wizard-step');

    wizardTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const step = parseInt(tab.getAttribute('data-step'), 10);
            switchWizardStep(step);
        });
    });

    function switchWizardStep(stepNum) {
        currentStep = stepNum;
        wizardTabs.forEach(t => {
            t.classList.toggle('active', parseInt(t.getAttribute('data-step'), 10) === stepNum);
        });
        wizardSteps.forEach((s, idx) => {
            s.classList.toggle('active', idx + 1 === stepNum);
        });
    }

    // -------------------------------------------------------------------------
    // Case Editor: Start New Case
    // -------------------------------------------------------------------------
    async function startNewCase() {
        let nextNumber = "WA-027";
        try {
            const res = await fetch('/api/next-case-number');
            if (res.ok) {
                const data = await res.json();
                nextNumber = data.next_case_number;
            }
        } catch (e) {}

        const today = new Date().toISOString().split('T')[0];

        activeCase = {
            case_number: nextNumber,
            patient_name: "",
            clinic_name: "While Aligners",
            case_date: today,
            upper_aligners: 7,
            lower_aligners: 10,
            wear_days: 10,
            upper_days: 70,
            lower_days: 100,
            elastic_type: "Class II / Anterior",
            elastic_size: "3/16 inch Medium",
            initial_image: "",
            final_image: "",
            movement_image_1: "",
            movement_image_2: "",
            pp_upper: "1-7",
            pp_lower: "1-7",
            notes: "Each aligner need to be worn for 10 days.",
            status: "draft",
            attachments: {},
            upper_movements: {},
            lower_movements: {},
            upper_ipr: {},
            lower_ipr: {}
        };

        populateEditorForm(activeCase);
        switchWizardStep(1);
        showView('editor');
    }

    // -------------------------------------------------------------------------
    // Case Editor: Edit Existing Case
    // -------------------------------------------------------------------------
    async function editCaseById(id) {
        try {
            const res = await fetch(`/api/cases/${id}`);
            if (!res.ok) throw new Error("Could not fetch case details");
            const data = await res.json();
            activeCase = data.case;
            populateEditorForm(activeCase);
            switchWizardStep(1);
            showView('editor');
        } catch (e) {
            showToast("Failed to open case: " + e.message, "error");
        }
    }

    function populateEditorForm(c) {
        document.getElementById('editor-case-badge').textContent = c.case_number || 'WA-000';
        document.getElementById('editor-title-name').textContent = c.patient_name ? `Case: ${c.patient_name}` : 'New Clinical Case';

        // Step 1: Meta
        document.getElementById('case-field-num').value = c.case_number || '';
        document.getElementById('case-field-patient').value = c.patient_name || '';
        document.getElementById('case-field-clinic').value = c.clinic_name || '';
        document.getElementById('case-field-date').value = c.case_date || '';
        document.getElementById('case-field-status').value = c.status || 'draft';
        document.getElementById('case-field-notes').value = c.notes || '';

        // Step 2: Plan
        document.getElementById('case-field-upper-aligners').value = c.upper_aligners || 0;
        document.getElementById('case-field-lower-aligners').value = c.lower_aligners || 0;
        document.getElementById('case-field-wear-days').value = c.wear_days || 10;
        document.getElementById('case-field-upper-days').value = c.upper_days || (c.upper_aligners * (c.wear_days || 10));
        document.getElementById('case-field-lower-days').value = c.lower_days || (c.lower_aligners * (c.wear_days || 10));
        document.getElementById('case-field-elastic-type').value = c.elastic_type || '';
        document.getElementById('case-field-elastic-size').value = c.elastic_size || '';
        document.getElementById('case-field-pp-upper').value = c.pp_upper || '1-7';
        document.getElementById('case-field-pp-lower').value = c.pp_lower || '1-7';

        // Auto-calculation on aligner/wear changes
        const upperIn = document.getElementById('case-field-upper-aligners');
        const lowerIn = document.getElementById('case-field-lower-aligners');
        const wearIn = document.getElementById('case-field-wear-days');
        const updateDays = () => {
            const w = parseInt(wearIn.value || 10, 10);
            const u = parseInt(upperIn.value || 0, 10);
            const l = parseInt(lowerIn.value || 0, 10);
            document.getElementById('case-field-upper-days').value = u * w;
            document.getElementById('case-field-lower-days').value = l * w;
        };
        upperIn.oninput = updateDays;
        lowerIn.oninput = updateDays;
        wearIn.oninput = updateDays;

        // Step 3: Movement Tables (if present) or Movement Scans
        const uMovCont = document.getElementById('upper-movement-container');
        const lMovCont = document.getElementById('lower-movement-container');
        if (uMovCont && window.MovementTable) {
            MovementTable.renderTable({
                container: uMovCont,
                arch: 'upper',
                teeth: ToothChart.UPPER_TEETH,
                movements: c.upper_movements || {}
            });
        }
        if (lMovCont && window.MovementTable) {
            MovementTable.renderTable({
                container: lMovCont,
                arch: 'lower',
                teeth: ToothChart.LOWER_TEETH,
                movements: c.lower_movements || {}
            });
        }

        // Step 3: Movement Chart Scans / Pictures
        updateImagePreview('movement-1', c.movement_image_1);
        updateImagePreview('movement-2', c.movement_image_2);

        // Step 4 & Step 2: Dental Arch Architecture & IPR
        refreshAllDentalArches();

        // Step 5: Images
        updateImagePreview('initial', c.initial_image);
        updateImagePreview('final', c.final_image);
    }

    // -------------------------------------------------------------------------
    // Image Upload Handlers
    // -------------------------------------------------------------------------
    setupDropzone('initial');
    setupDropzone('final');
    setupDropzone('movement-1');
    setupDropzone('movement-2');

    function setupDropzone(type) {
        const dropzone = document.getElementById(`dropzone-${type}`);
        const fileInput = document.getElementById(`file-input-${type}`);
        if (!dropzone || !fileInput) return;

        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--color-brand-500)';
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'var(--border-color)';
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--border-color)';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleImageFile(type, e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleImageFile(type, e.target.files[0]);
            }
        });
    }

    function handleImageFile(type, file) {
        if (!file.type.startsWith('image/')) {
            showToast("Please upload an image file (PNG, JPG, WEBP)", "error");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target.result;
            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dataUrl, prefix: type })
                });
                const data = await res.json();
                if (data.ok) {
                    if (type === 'initial') activeCase.initial_image = data.url;
                    else if (type === 'final') activeCase.final_image = data.url;
                    else if (type === 'movement-1') activeCase.movement_image_1 = data.url;
                    else if (type === 'movement-2') activeCase.movement_image_2 = data.url;

                    updateImagePreview(type, data.url);
                    showToast(`Photo uploaded successfully!`);
                } else {
                    throw new Error(data.error);
                }
            } catch (err) {
                showToast("Upload failed: " + err.message, "error");
            }
        };
        reader.readAsDataURL(file);
    }

    function updateImagePreview(type, url) {
        const previewBox = document.getElementById(`preview-box-${type}`);
        if (!previewBox) return;
        if (url) {
            previewBox.innerHTML = `
                <img src="${url}" class="upload-preview-img" alt="${type} photo" style="max-height:220px; object-fit:contain;">
                <div style="margin-top:8px;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.removePhoto('${type}')">Remove Photo</button>
                </div>
            `;
        } else {
            let icon = '📷';
            let label = 'Click or drag photo here';
            let hint = 'PNG, JPG, WEBP up to 10MB';
            if (type === 'final') {
                icon = '✨';
            } else if (type === 'movement-1') {
                icon = '📊';
                label = 'Click or drag IPR movement chart pic here';
                hint = 'PNG, JPG, WEBP up to 15MB';
            } else if (type === 'movement-2') {
                icon = '📐';
                label = 'Click or drag second movement / IPR pic here';
                hint = 'Optional • PNG, JPG, WEBP';
            }
            previewBox.innerHTML = `
                <div style="font-size:2.5rem; color:var(--color-brand-400); margin-bottom:8px;">${icon}</div>
                <div style="font-weight:600; font-size:0.9rem;">${label}</div>
                <div class="upload-hint">${hint}</div>
            `;
        }
    }

    window.removePhoto = (type) => {
        if (type === 'initial') activeCase.initial_image = '';
        else if (type === 'final') activeCase.final_image = '';
        else if (type === 'movement-1') activeCase.movement_image_1 = '';
        else if (type === 'movement-2') activeCase.movement_image_2 = '';
        updateImagePreview(type, '');
        showToast("Photo removed");
    };

    // -------------------------------------------------------------------------
    // Dental Arch & Clinical Features (Attachments, Powers, Buttons, IPR)
    // -------------------------------------------------------------------------
    let activeModalToothFDI = null;

    function refreshAllDentalArches() {
        if (!activeCase) return;

        // Step 2 Arches
        const s2Upper = document.getElementById('step2-upper-arch-container');
        const s2Lower = document.getElementById('step2-lower-arch-container');
        const s2Legend = document.getElementById('step2-arch-legend-container');

        if (s2Upper && s2Lower) {
            ToothChart.renderArch({
                container: s2Upper,
                isLower: false,
                iprData: activeCase.upper_ipr || {},
                attachments: activeCase.attachments || {},
                onIprClick: handleIprClick,
                onToothClick: handleToothClick
            });

            ToothChart.renderArch({
                container: s2Lower,
                isLower: true,
                iprData: activeCase.lower_ipr || {},
                attachments: activeCase.attachments || {},
                onIprClick: handleIprClick,
                onToothClick: handleToothClick
            });
        }

        // Step 4 Arches
        const s4Upper = document.getElementById('upper-tooth-chart-container');
        const s4Lower = document.getElementById('lower-tooth-chart-container');
        const s4Summary = document.getElementById('ipr-summary-container');

        if (s4Upper && s4Lower) {
            ToothChart.renderArch({
                container: s4Upper,
                isLower: false,
                iprData: activeCase.upper_ipr || {},
                attachments: activeCase.attachments || {},
                onIprClick: handleIprClick,
                onToothClick: handleToothClick
            });

            ToothChart.renderArch({
                container: s4Lower,
                isLower: true,
                iprData: activeCase.lower_ipr || {},
                attachments: activeCase.attachments || {},
                onIprClick: handleIprClick,
                onToothClick: handleToothClick
            });

            if (s4Summary) {
                renderIprProtocolSummary(s4Summary);
            }
        }

        // Live Legend for Step 2
        if (s2Legend) {
            renderLiveFeaturesLegend(s2Legend);
        }
    }

    function handleToothClick({ fdi, arch, feature }) {
        activeModalToothFDI = fdi;
        openToothFeatureModal(fdi, arch, feature);
    }

    function handleIprClick({ contact, arch, existing }) {
        IprChart.openIprModal(contact, arch, existing, activeCase);
    }

    function openToothFeatureModal(fdi, arch, feat) {
        const modal = document.getElementById('tooth-feature-modal');
        if (!modal) return;

        const palmer = ToothChart.getPalmerNumber(fdi);
        const type = ToothChart.getToothType(fdi);
        const archName = arch === 'upper' ? 'Maxillary (Upper)' : 'Mandibular (Lower)';

        document.getElementById('tooth-modal-title').textContent = `Configure Tooth ${fdi} Features`;
        document.getElementById('tooth-modal-subtitle').textContent = `Palmer #${palmer} • ${archName} ${type.toUpperCase()}`;

        const f = ToothChart.normalizeFeature(feat || (activeCase.attachments ? activeCase.attachments[fdi] : null));

        const chkAtt = document.getElementById('chk-attachment');
        const selAtt = document.getElementById('sel-attachment-type');
        chkAtt.checked = !!f.attachment;
        if (f.attachment) selAtt.value = f.attachment;

        const chkPP = document.getElementById('chk-power-point');
        const selPP = document.getElementById('sel-power-point-type');
        chkPP.checked = !!f.power_point;
        if (f.pp_type) selPP.value = f.pp_type;

        const chkBtn = document.getElementById('chk-button');
        const selBtn = document.getElementById('sel-button-type');
        chkBtn.checked = !!f.button;
        if (f.button) selBtn.value = f.button;

        const chkRamp = document.getElementById('chk-bite-ramp');
        chkRamp.checked = !!f.bite_ramp;

        document.getElementById('tooth-modal-notes').value = f.notes || '';

        modal.classList.add('open');
    }

    function closeToothFeatureModal() {
        const modal = document.getElementById('tooth-feature-modal');
        if (modal) modal.classList.remove('open');
    }

    function saveToothFeaturesFromModal() {
        if (!activeModalToothFDI || !activeCase) return;

        const chkAtt = document.getElementById('chk-attachment').checked;
        const selAtt = document.getElementById('sel-attachment-type').value;

        const chkPP = document.getElementById('chk-power-point').checked;
        const selPP = document.getElementById('sel-power-point-type').value;

        const chkBtn = document.getElementById('chk-button').checked;
        const selBtn = document.getElementById('sel-button-type').value;

        const chkRamp = document.getElementById('chk-bite-ramp').checked;
        const notes = document.getElementById('tooth-modal-notes').value.trim();

        if (!activeCase.attachments) activeCase.attachments = {};

        if (!chkAtt && !chkPP && !chkBtn && !chkRamp && !notes) {
            delete activeCase.attachments[activeModalToothFDI];
        } else {
            activeCase.attachments[activeModalToothFDI] = {
                attachment: chkAtt ? selAtt : '',
                power_point: chkPP,
                pp_type: chkPP ? selPP : '',
                button: chkBtn ? selBtn : '',
                bite_ramp: chkRamp,
                notes: notes
            };
        }

        closeToothFeatureModal();
        refreshAllDentalArches();
        showToast(`Updated features for Tooth ${activeModalToothFDI}`);
    }

    function clearToothFeaturesFromModal() {
        if (!activeModalToothFDI || !activeCase) return;
        if (activeCase.attachments) {
            delete activeCase.attachments[activeModalToothFDI];
        }
        closeToothFeatureModal();
        refreshAllDentalArches();
        showToast(`Cleared features for Tooth ${activeModalToothFDI}`);
    }

    // Tooth Feature Modal Listeners
    document.getElementById('btn-tooth-modal-close').addEventListener('click', closeToothFeatureModal);
    document.getElementById('btn-tooth-modal-cancel').addEventListener('click', closeToothFeatureModal);
    document.getElementById('btn-tooth-modal-save').addEventListener('click', saveToothFeaturesFromModal);
    document.getElementById('btn-tooth-modal-clear').addEventListener('click', clearToothFeaturesFromModal);

    // Quick Presets
    document.getElementById('btn-quick-pp-upper').addEventListener('click', () => {
        if (!activeCase) return;
        if (!activeCase.attachments) activeCase.attachments = {};
        const upperTeeth = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];
        upperTeeth.forEach(t => {
            const f = ToothChart.normalizeFeature(activeCase.attachments[t]);
            f.power_point = true;
            f.pp_type = "Torque Ridge Protocol";
            activeCase.attachments[t] = f;
        });
        activeCase.pp_upper = "1-7";
        document.getElementById('case-field-pp-upper').value = "1-7";
        refreshAllDentalArches();
        showToast("⚡ Assigned Power Points (P.P 1-7) to Upper Arch");
    });

    document.getElementById('btn-quick-pp-lower').addEventListener('click', () => {
        if (!activeCase) return;
        if (!activeCase.attachments) activeCase.attachments = {};
        const lowerTeeth = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];
        lowerTeeth.forEach(t => {
            const f = ToothChart.normalizeFeature(activeCase.attachments[t]);
            f.power_point = true;
            f.pp_type = "Torque Ridge Protocol";
            activeCase.attachments[t] = f;
        });
        activeCase.pp_lower = "1-7";
        document.getElementById('case-field-pp-lower').value = "1-7";
        refreshAllDentalArches();
        showToast("⚡ Assigned Power Points (P.P 1-7) to Lower Arch");
    });

    // -------------------------------------------------------------------------
    // IPR Modal Handlers
    // -------------------------------------------------------------------------
    document.getElementById('btn-modal-close').addEventListener('click', () => IprChart.closeIprModal());
    document.getElementById('btn-modal-cancel').addEventListener('click', () => IprChart.closeIprModal());

    document.getElementById('btn-modal-save-ipr').addEventListener('click', () => {
        IprChart.saveIprFromModal(() => {
            refreshAllDentalArches();
            showToast("IPR protocol applied");
        }, activeCase);
    });

    document.getElementById('btn-modal-clear-ipr').addEventListener('click', () => {
        IprChart.clearIprFromModal(() => {
            refreshAllDentalArches();
            showToast("IPR setting cleared");
        }, activeCase);
    });

    document.querySelectorAll('.ipr-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mm = btn.getAttribute('data-mm');
            document.getElementById('ipr-modal-amount').value = mm;
            IprChart.updatePresetButtons(mm);
        });
    });

    const iprAmountInput = document.getElementById('ipr-modal-amount');
    if (iprAmountInput) {
        iprAmountInput.addEventListener('input', (e) => {
            IprChart.updatePresetButtons(e.target.value);
        });
    }

    document.querySelectorAll('.ipr-stage-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const stage = btn.getAttribute('data-stage');
            const selectEl = document.getElementById('ipr-modal-stage');
            if (selectEl) {
                selectEl.value = stage;
            }
            IprChart.updateStagePresetButtons(stage);
        });
    });

    const iprStageSelect = document.getElementById('ipr-modal-stage');
    if (iprStageSelect) {
        iprStageSelect.addEventListener('change', (e) => {
            IprChart.updateStagePresetButtons(e.target.value);
        });
    }

    function renderLiveFeaturesLegend(container) {
        if (!container || !activeCase) return;
        const att = activeCase.attachments || {};
        const attList = [];
        const ppList = [];
        const btnList = [];
        const rampList = [];

        [...ToothChart.UPPER_TEETH, ...ToothChart.LOWER_TEETH].forEach(t => {
            const f = ToothChart.normalizeFeature(att[t]);
            if (f.attachment) attList.push(`<strong>${t}</strong> (${f.attachment})`);
            if (f.power_point) ppList.push(`${t}`);
            if (f.button) btnList.push(`<strong>${t}</strong> (${f.button})`);
            if (f.bite_ramp) rampList.push(`${t}`);
        });

        const upperIpr = activeCase.upper_ipr || {};
        const lowerIpr = activeCase.lower_ipr || {};
        const uIprCount = Object.keys(upperIpr).filter(k => parseFloat(upperIpr[k].amount) > 0).length;
        const lIprCount = Object.keys(lowerIpr).filter(k => parseFloat(lowerIpr[k].amount) > 0).length;

        container.innerHTML = `
            <div style="background:var(--color-slate-50); border:1px solid var(--border-color); border-radius:10px; padding:12px 16px; font-size:0.82rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-family:var(--font-display); font-weight:700; color:var(--color-slate-900);">Protocol Features Legend</span>
                    <span style="font-size:0.75rem; color:var(--text-muted);">(Live update on chart click)</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px; line-height:1.4;">
                    <div>🧲 <strong>Attachments (${attList.length}):</strong> ${attList.length > 0 ? attList.join(', ') : '<em>None assigned</em>'}</div>
                    <div>⚡ <strong>Power Points (P.P):</strong> ${ppList.length > 0 ? `Teeth ${ppList.join(', ')}` : (activeCase.pp_upper ? `Upper: ${activeCase.pp_upper} • Lower: ${activeCase.pp_lower || '1-7'}` : '<em>None assigned</em>')}</div>
                    <div>🔘 <strong>Buttons / Cutouts (${btnList.length}):</strong> ${btnList.length > 0 ? btnList.join(', ') : '<em>None assigned</em>'}</div>
                    ${rampList.length > 0 ? `<div>📐 <strong>Bite Ramps:</strong> Teeth ${rampList.join(', ')}</div>` : ''}
                    <div>✂️ <strong>Active IPR Contacts:</strong> Upper: ${uIprCount} contacts • Lower: ${lIprCount} contacts</div>
                </div>
            </div>
        `;
    }

    function renderIprProtocolSummary(container) {
        if (!container || !activeCase) return;
        const upper = activeCase.upper_ipr || {};
        const lower = activeCase.lower_ipr || {};

        let html = `
            <div class="ipr-summary-blocks">
                <h4 style="font-family:var(--font-display); margin-bottom:12px; color:var(--color-slate-900);">Active IPR Protocols</h4>
                <div class="ipr-details-grid">
        `;

        let count = 0;
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

    // -------------------------------------------------------------------------
    // Case Save & Delete Handlers
    // -------------------------------------------------------------------------
    async function saveCurrentCase() {
        if (!activeCase) return;

        // Gather from form
        activeCase.case_number = document.getElementById('case-field-num').value.trim();
        activeCase.patient_name = document.getElementById('case-field-patient').value.trim();
        activeCase.clinic_name = document.getElementById('case-field-clinic').value.trim();
        activeCase.case_date = document.getElementById('case-field-date').value;
        activeCase.status = document.getElementById('case-field-status').value;
        activeCase.notes = document.getElementById('case-field-notes').value.trim();

        activeCase.upper_aligners = parseInt(document.getElementById('case-field-upper-aligners').value || 0, 10);
        activeCase.lower_aligners = parseInt(document.getElementById('case-field-lower-aligners').value || 0, 10);
        activeCase.wear_days = parseInt(document.getElementById('case-field-wear-days').value || 10, 10);
        activeCase.upper_days = parseInt(document.getElementById('case-field-upper-days').value || 0, 10);
        activeCase.lower_days = parseInt(document.getElementById('case-field-lower-days').value || 0, 10);
        activeCase.elastic_type = document.getElementById('case-field-elastic-type').value.trim();
        activeCase.elastic_size = document.getElementById('case-field-elastic-size').value.trim();
        activeCase.pp_upper = document.getElementById('case-field-pp-upper').value.trim();
        activeCase.pp_lower = document.getElementById('case-field-pp-lower').value.trim();

        if (!activeCase.patient_name) {
            showToast("Please enter Patient Name", "error");
            switchWizardStep(1);
            return;
        }

        // Extract Movement tables (if present in DOM)
        const uMovElem = document.getElementById('upper-movement-container');
        const lMovElem = document.getElementById('lower-movement-container');
        if (uMovElem && window.MovementTable) {
            activeCase.upper_movements = MovementTable.extractMovements(uMovElem, ToothChart.UPPER_TEETH);
        }
        if (lMovElem && window.MovementTable) {
            activeCase.lower_movements = MovementTable.extractMovements(lMovElem, ToothChart.LOWER_TEETH);
        }

        // IPR data is already live in activeCase.upper_ipr and activeCase.lower_ipr

        try {
            const isUpdate = !!activeCase.id;
            const url = isUpdate ? `/api/cases/${activeCase.id}` : '/api/cases';
            const method = isUpdate ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(activeCase)
            });

            const data = await res.json();
            if (data.ok) {
                activeCase = data.case;
                showToast(`Case ${activeCase.case_number} saved successfully!`);
                await loadCases();
                showView('dashboard');
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            showToast("Save failed: " + err.message, "error");
        }
    }

    async function deleteCase(id) {
        try {
            const res = await fetch(`/api/cases/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast("Case deleted successfully");
                await loadCases();
            } else {
                throw new Error("Delete failed");
            }
        } catch (e) {
            showToast("Failed to delete case: " + e.message, "error");
        }
    }

    // -------------------------------------------------------------------------
    // Report Preview Handlers
    // -------------------------------------------------------------------------
    function previewPdfReport() {
        if (!activeCase) return;

        // Ensure movement tables and fields are collected if currently in editor
        if (viewEditor.classList.contains('active')) {
            activeCase.patient_name = document.getElementById('case-field-patient').value.trim();
            activeCase.clinic_name = document.getElementById('case-field-clinic').value.trim();
            activeCase.case_date = document.getElementById('case-field-date').value;
            activeCase.case_number = document.getElementById('case-field-num').value.trim();
            activeCase.upper_aligners = parseInt(document.getElementById('case-field-upper-aligners').value || 0, 10);
            activeCase.lower_aligners = parseInt(document.getElementById('case-field-lower-aligners').value || 0, 10);
            activeCase.wear_days = parseInt(document.getElementById('case-field-wear-days').value || 10, 10);
            activeCase.upper_days = parseInt(document.getElementById('case-field-upper-days').value || 0, 10);
            activeCase.lower_days = parseInt(document.getElementById('case-field-lower-days').value || 0, 10);
            activeCase.elastic_type = document.getElementById('case-field-elastic-type').value.trim();
            activeCase.elastic_size = document.getElementById('case-field-elastic-size').value.trim();
            activeCase.pp_upper = document.getElementById('case-field-pp-upper').value.trim();
            activeCase.pp_lower = document.getElementById('case-field-pp-lower').value.trim();
            activeCase.notes = document.getElementById('case-field-notes').value.trim();

            const uMovElem = document.getElementById('upper-movement-container');
            const lMovElem = document.getElementById('lower-movement-container');
            if (uMovElem && window.MovementTable) {
                activeCase.upper_movements = MovementTable.extractMovements(uMovElem, ToothChart.UPPER_TEETH);
            }
            if (lMovElem && window.MovementTable) {
                activeCase.lower_movements = MovementTable.extractMovements(lMovElem, ToothChart.LOWER_TEETH);
            }
        }

        const renderTarget = document.getElementById('report-render-target');
        PdfExport.renderReport(renderTarget, activeCase);
        showView('report');
    }

    // -------------------------------------------------------------------------
    // Initial Load
    // -------------------------------------------------------------------------
    loadCases();
});
