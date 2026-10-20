/**
 * VélourCare Ortho — Clinical Movement Table Engine
 * Handles dense orthodontic movement metric data entry matching the WA-026 document.
 */

const MovementTable = (() => {
    const METRICS = [
        { key: "strip_mesial", label: "Strip Mesial [mm]", step: "0.1", min: "0", max: "2" },
        { key: "strip_distal", label: "Strip Distal [mm]", step: "0.1", min: "0", max: "2" },
        { key: "inclination", label: "Inclination [°]", step: "0.1" },
        { key: "inclination_change", label: "Inclination +/- [°]", step: "0.1" },
        { key: "angulation", label: "Angulation [°]", step: "0.1" },
        { key: "angulation_change", label: "Angulation +/- [°]", step: "0.1" },
        { key: "rotation_change", label: "Rotation +/- [°]", step: "0.1" },
        { key: "mesial_change", label: "Mesial +/- [mm]", step: "0.01" },
        { key: "vestibular_change", label: "Vestibular +/- [mm]", step: "0.01" },
        { key: "occlusal_change", label: "Occlusal +/- [mm]", step: "0.01" }
    ];

    function renderTable({ container, arch, teeth, movements = {} }) {
        let html = `
            <table class="movement-table" data-arch="${arch}">
                <thead>
                    <tr>
                        <th class="metric-col-title">Metric / Tooth</th>
        `;

        teeth.forEach(fdi => {
            html += `<th>${fdi}</th>`;
        });

        html += `
                    </tr>
                </thead>
                <tbody>
        `;

        METRICS.forEach(metric => {
            html += `
                <tr>
                    <td class="metric-col-label">${metric.label}</td>
            `;

            teeth.forEach(fdi => {
                const toothData = movements[fdi] || {};
                const val = toothData[metric.key] !== undefined && toothData[metric.key] !== null ? toothData[metric.key] : "";
                
                let cls = "";
                if (val !== "" && typeof val === 'number') {
                    if (val > 0) cls = "positive";
                    else if (val < 0) cls = "negative";
                }

                html += `
                    <td>
                        <input type="number" 
                               class="movement-cell-input ${cls}" 
                               data-tooth="${fdi}" 
                               data-metric="${metric.key}"
                               step="${metric.step || '0.1'}"
                               value="${val === 0 ? '' : val}" 
                               placeholder="—" />
                    </td>
                `;
            });

            html += `</tr>`;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;

        // Color updating & keyboard navigation
        const inputs = container.querySelectorAll('.movement-cell-input');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                e.target.classList.remove('positive', 'negative');
                if (!isNaN(v)) {
                    if (v > 0) e.target.classList.add('positive');
                    else if (v < 0) e.target.classList.add('negative');
                }
            });
        });
    }

    function extractMovements(container, teeth) {
        const result = {};
        teeth.forEach(fdi => {
            result[fdi] = {};
            METRICS.forEach(m => {
                const input = container.querySelector(`input[data-tooth="${fdi}"][data-metric="${m.key}"]`);
                if (input && input.value.trim() !== "") {
                    result[fdi][m.key] = parseFloat(input.value.trim());
                } else {
                    result[fdi][m.key] = 0;
                }
            });
        });
        return result;
    }

    return {
        METRICS,
        renderTable,
        extractMovements
    };
})();

window.MovementTable = MovementTable;
