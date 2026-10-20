/**
 * VélourCare Ortho — Clinical Case Report PDF & Print Generator
 * Formats multi-page clinical documentation matching WA-026 standards with high-res SVG vectors.
 */

const PdfExport = (() => {

    function generateReportHTML(caseData) {
        const c = caseData;
        const wearDays = c.wear_days || 10;
        const upperDays = c.upper_days || (c.upper_aligners * wearDays);
        const lowerDays = c.lower_days || (c.lower_aligners * wearDays);

        // Movement tables
        const upperTeeth = ToothChart.UPPER_TEETH;
        const lowerTeeth = ToothChart.LOWER_TEETH;

        function buildMovementRows(teeth, movements) {
            return MovementTable.METRICS.map(m => {
                const cells = teeth.map(fdi => {
                    const t = movements[fdi] || {};
                    const v = t[m.key];
                    if (v === undefined || v === null || v === 0 || v === "") {
                        return `<td></td>`;
                    }
                    const num = parseFloat(v);
                    const cls = num > 0 ? 'pos' : (num < 0 ? 'neg' : '');
                    return `<td class="${cls}">${num}</td>`;
                }).join('');

                return `
                    <tr>
                        <td class="col-name">${m.label}</td>
                        ${cells}
                    </tr>
                `;
            }).join('');
        }

        // IPR rows
        function buildIprRows(iprDict, archName) {
            const keys = Object.keys(iprDict || {});
            if (keys.length === 0) return `<tr><td colspan="4" style="text-align:center;color:#999;">No IPR required for ${archName}</td></tr>`;

            return keys.map(k => {
                const item = iprDict[k];
                return `
                    <tr>
                        <td style="font-weight:600;">${archName}</td>
                        <td style="font-family:var(--font-mono);font-weight:700;">${k}</td>
                        <td style="color:#B45309;font-weight:700;">${item.amount} mm</td>
                        <td>${item.stage || 'Stage 1'}</td>
                    </tr>
                `;
            }).join('');
        }

        return `
            <div class="report-document" id="printable-case-report">
                <!-- ================= PAGE 1: TREATMENT OVERVIEW ================= -->
                <div class="report-page" id="page-1">
                    <div>
                        <div class="report-header">
                            <div class="report-brand-lockup">
                                <img src="assets/logo-emblem.png" alt="VélourCare Ortho" class="report-logo-img">
                                <div class="report-brand-text">
                                    <h2>VÉLOURCARE ORTHO</h2>
                                    <span>Precision Clear Aligner System</span>
                                </div>
                            </div>
                            <div class="report-meta-box">
                                <div class="report-case-id">CASE #${c.case_number || 'WA-026'}</div>
                                <div class="report-patient-name">PATIENT: ${(c.patient_name || '').toUpperCase()}</div>
                                <div class="report-clinic-name">CLINIC: ${(c.clinic_name || '').toUpperCase()}</div>
                                <div class="report-date">DATE: ${c.case_date || ''}</div>
                            </div>
                        </div>

                        <div class="report-section-title">
                            <span>TREATMENT OVERVIEW</span>
                            <span class="tag">CLINICAL STAGING PROTOCOL</span>
                        </div>

                        <!-- Dental Arch Diagram with Realistic Anatomical Teeth & Clinical Features -->
                        ${ToothChart.renderOverviewDualArchHTML(c)}


                        <!-- Elastics & Aligners Grid -->
                        <div class="plan-summary-grid">
                            <div class="plan-summary-card">
                                <div class="plan-card-title">Intermaxillary Elastics</div>
                                <div class="plan-stat-row">
                                    <span>Elastic Type:</span>
                                    <span class="plan-stat-val">${c.elastic_type || 'None / Not Assigned'}</span>
                                </div>
                                <div class="plan-stat-row">
                                    <span>Elastic Size / Force:</span>
                                    <span class="plan-stat-val">${c.elastic_size || 'Standard'}</span>
                                </div>
                            </div>

                            <div class="plan-summary-card">
                                <div class="plan-card-title">Aligner Count & Timeline</div>
                                <div class="plan-stat-row">
                                    <span>Total Aligners (Upper):</span>
                                    <span class="plan-stat-val"># ${c.upper_aligners || 0}</span>
                                </div>
                                <div class="plan-stat-row">
                                    <span>Total Aligners (Lower):</span>
                                    <span class="plan-stat-val"># ${c.lower_aligners || 0}</span>
                                </div>
                                <div class="plan-stat-row" style="margin-top:6px; padding-top:4px; border-top:1px dashed #EDE8DF;">
                                    <span>Est. Treatment Time (Upper):</span>
                                    <span class="plan-stat-val">${upperDays} DAYS</span>
                                </div>
                                <div class="plan-stat-row">
                                    <span>Est. Treatment Time (Lower):</span>
                                    <span class="plan-stat-val">${lowerDays} DAYS</span>
                                </div>
                            </div>
                        </div>

                        <div class="compliance-notice">
                            <strong>* Clinical Wear Instruction:</strong> Each aligner must be worn continuously for <strong>${wearDays} days</strong> (20–22 hours daily). Remove solely for meals and oral hygiene.
                        </div>

                        ${c.notes ? `
                            <div style="margin-top:16px; background:#FCFBF8; border:1px solid #E5E0D6; border-radius:8px; padding:12px 16px; font-size:0.82rem;">
                                <strong>Clinical Notes:</strong> ${c.notes}
                            </div>
                        ` : ''}
                    </div>

                    <div class="report-footer">
                        <span class="report-footer-brand">VÉLOURCARE ORTHO • MEDICAL DEVICE CLASS IIa • CE 2797</span>
                        <span>Page 1 of 3</span>
                    </div>
                </div>

                <!-- ================= PAGE 2: SMILE SUMMARY ================= -->
                <div class="report-page" id="page-2">
                    <div>
                        <div class="report-header">
                            <div class="report-brand-lockup">
                                <div class="report-brand-text">
                                    <h2>VÉLOURCARE ORTHO</h2>
                                    <span>Digital Diagnostic Simulation</span>
                                </div>
                            </div>
                            <div class="report-meta-box">
                                <div class="report-case-id">CASE #${c.case_number || 'WA-026'}</div>
                                <div class="report-patient-name">PATIENT: ${(c.patient_name || '').toUpperCase()}</div>
                                <div class="report-date">DATE: ${c.case_date || ''}</div>
                            </div>
                        </div>

                        <div class="report-section-title">
                            <span>SMILE SUMMARY</span>
                            <span class="tag">BEFORE & AFTER PROJECTION</span>
                        </div>

                        <div class="smile-summary-container">
                            <div class="smile-image-comparison">
                                <div class="smile-view-box">
                                    <div class="smile-view-title">Initial Position</div>
                                    ${c.initial_image ? `
                                        <img src="${c.initial_image}" alt="Initial Position">
                                    ` : `
                                        <div class="smile-placeholder">
                                            <p>No initial photo uploaded</p>
                                            <span style="font-size:0.75rem;">(Upload smile photo in Case Editor)</span>
                                        </div>
                                    `}
                                </div>

                                <div class="smile-view-box">
                                    <div class="smile-view-title">Final Position (Simulated Outcome)</div>
                                    ${c.final_image ? `
                                        <img src="${c.final_image}" alt="Final Position">
                                    ` : `
                                        <div class="smile-placeholder">
                                            <p>No final simulation photo uploaded</p>
                                            <span style="font-size:0.75rem;">(Upload projected outcome in Case Editor)</span>
                                        </div>
                                    `}
                                </div>
                            </div>

                            <div class="smile-notes-box">
                                <strong>Biomechanical Staging Summary:</strong><br>
                                Orthodontic movements simulated and staged using OnyxCeph³ 3D digital planning suite. Physiological force delivery engineered for optimal tooth translation, torque correction, and interdental spacing closure.
                            </div>
                        </div>
                    </div>

                    <div class="report-footer">
                        <span class="report-footer-brand">VÉLOURCARE ORTHO • MEDICAL DEVICE CLASS IIa • CE 2797</span>
                        <span>Page 2 of 3</span>
                    </div>
                </div>

                <!-- ================= PAGE 3: MOVEMENT CHART & IPR ================= -->
                <div class="report-page" id="page-3">
                    <div>
                        <div class="report-header">
                            <div class="report-brand-lockup">
                                <div class="report-brand-text">
                                    <h2>VÉLOURCARE ORTHO</h2>
                                    <span>Orthodontic Movement & IPR Protocol</span>
                                </div>
                            </div>
                            <div class="report-meta-box">
                                <div class="report-case-id">CASE #${c.case_number || 'WA-026'}</div>
                                <div class="report-patient-name">PATIENT: ${(c.patient_name || '').toUpperCase()}</div>
                                <div class="report-date">DATE: ${c.case_date || ''}</div>
                            </div>
                        </div>

                        <div class="report-section-title">
                            <span>ORTHODONTIC MOVEMENT & IPR SCANS</span>
                            <span class="tag">CLINICAL STAGING PROTOCOL</span>
                        </div>

                        <!-- IPR & Movement Chart Uploaded Picture Section -->
                        <div class="movement-pictures-report-container">
                            ${(c.movement_image_1 || c.movement_image_2) ? `
                                <div class="movement-images-grid ${(!c.movement_image_1 || !c.movement_image_2) ? 'single-image' : 'dual-image'}">
                                    ${c.movement_image_1 ? `
                                        <div class="movement-image-card">
                                            <div class="movement-card-title">Movement Chart / Upper Arch Scan</div>
                                            <div class="movement-image-frame">
                                                <img src="${c.movement_image_1}" alt="Movement Chart 1" class="movement-report-img">
                                            </div>
                                        </div>
                                    ` : ''}
                                    ${c.movement_image_2 ? `
                                        <div class="movement-image-card">
                                            <div class="movement-card-title">IPR Staging / Lower Arch Scan</div>
                                            <div class="movement-image-frame">
                                                <img src="${c.movement_image_2}" alt="Movement Chart 2" class="movement-report-img">
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            ` : `
                                <div class="movement-placeholder-box">
                                    <div style="font-size:2.2rem; color:#B89B69; margin-bottom:6px;">📊</div>
                                    <p style="font-weight:600; color:#1E252B; margin-bottom:4px; font-size:0.9rem;">No IPR Movement Chart scans uploaded</p>
                                    <span style="font-size:0.75rem; color:#8C7D6B;">(Drag and drop movement chart scans in Case Editor — Step 3)</span>
                                </div>
                            `}
                        </div>

                        <!-- IPR Protocol Section -->
                        <div class="report-section-title" style="margin-top:16px;">
                            <span>IPR SUMMARY (INTERPROXIMAL REDUCTION)</span>
                            <span class="tag">CLINICAL STRIPPING GUIDE</span>
                        </div>

                        <table style="width:100%; border-collapse:collapse; font-size:0.75rem; margin-top:8px; border:1px solid #D1CBBE;">
                            <thead>
                                <tr style="background:#EDE5D0; font-family:var(--font-mono);">
                                    <th style="padding:6px; border:1px solid #D1CBBE; text-align:left;">Arch</th>
                                    <th style="padding:6px; border:1px solid #D1CBBE; text-align:left;">Contact Location</th>
                                    <th style="padding:6px; border:1px solid #D1CBBE; text-align:left;">Amount (mm)</th>
                                    <th style="padding:6px; border:1px solid #D1CBBE; text-align:left;">Action Stage</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${buildIprRows(c.upper_ipr, 'Upper Arch')}
                                ${buildIprRows(c.lower_ipr, 'Lower Arch')}
                            </tbody>
                        </table>
                    </div>

                    <div class="report-footer">
                        <span class="report-footer-brand">VÉLOURCARE ORTHO • MEDICAL DEVICE CLASS IIa • CE 2797</span>
                        <span>Page 3 of 3</span>
                    </div>
                </div>
            </div>
        `;
    }

    function renderReport(container, caseData) {
        container.innerHTML = generateReportHTML(caseData);
    }

    function triggerPrint() {
        window.print();
    }

    return {
        generateReportHTML,
        renderReport,
        triggerPrint
    };
})();

window.PdfExport = PdfExport;
