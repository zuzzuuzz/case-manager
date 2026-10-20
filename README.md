# VélourCare Ortho — Clinical Case Report Manager

A web-based case management and treatment protocol application designed for **VélourCare Ortho**. It allows clinical teams (2–5 members) to create, manage, and print doctor-supervised clear aligner case reports matching and perfecting the **WA-026** clinical documentation format.

---

## 🌟 Key Features

1. **WA-026 Reference Compatibility & Perfection**
   - Directly incorporates the exact 3-page clinical case report structure from your `WA-026` document.
   - Page 1: **Treatment Overview** (Patient meta, quadrant arch diagram, aligner totals, treatment days, wear rules, and elastic prescriptions).
   - Page 2: **Smile Summary** (High-resolution initial vs. simulated final position photographic comparison).
   - Page 3: **Movement Chart & IPR Summary** (Full 10-vector FDI tooth movement tables + anatomical IPR stripping protocol).

2. **Realistic Anatomical Tooth Architecture in IPR Section**
   - Unlike basic flat table numbers, teeth are rendered with **realistic dental morphologies**:
     - **Molars**: Multi-cusped wide occlusal profiles with anatomical fissures and developmental grooves.
     - **Premolars / Bicuspids**: Dual-cusped crowns with central grooves.
     - **Canines**: Tapered crowns with pointed single cusps and prominent labial ridges.
     - **Incisors**: Shovel-shaped crowns with realistic mamelon contours.
   - Interactive interdental contact clickers (`+` / `✂`) allow assigning reduction in millimeters (0.1, 0.2, 0.3, 0.4, 0.5 mm) and action stage (Stage 1 to 7).

3. **High-Density Orthodontic Movement Grid**
   - Dense FDI grid (Upper 18→28, Lower 48→38) for all 10 clinical vectors:
     - Strip Mesial [mm], Strip Distal [mm]
     - Inclination [°], Inclination +/- [°]
     - Angulation [°], Angulation +/- [°]
     - Rotation +/- [°]
     - Mesial +/- [mm], Vestibular +/- [mm], Occlusal +/- [mm]
   - Color-coded cells (Blue for positive/expansion, Red for negative/retraction/torque).

4. **Multi-Device & Remote Team Access**
   - Embedded Cloudflare Tunnel: Launching the app automatically generates a secure, free **HTTPS URL** for your clinical team to access from phones, iPads, or remote office laptops.
   - Auto-copies with one click from the top navigation bar.

5. **Local SQLite Persistence & Automated Backups**
   - All data is saved locally in `data/cases.db`.
   - Every change automatically produces timestamped JSON backups in `data/backups/`.

---

## 🚀 How to Run

### Method 1: One-Click Launcher (Recommended)
Double-click:
```
D:\Antigravity\velourcare-case-manager\start_server.bat
```

### Method 2: Command Line
Open PowerShell or Command Prompt:
```bash
cd D:\Antigravity\velourcare-case-manager
python server.py
```

The application will automatically:
1. Initialize the SQLite database with the sample **WA-026 (TASBEEHA)** reference case.
2. Launch your default web browser to `http://localhost:8010/`.
3. Start the Cloudflare HTTPS tunnel for mobile and remote access.

---

## 📄 Exporting / Printing to PDF

1. Click the **"📄 PDF"** button on any case card in the dashboard or click **"Print / PDF"** in the case editor.
2. The print preview displays the clinical 3-page A4 report with VélourCare branding and CE 2797 / Medical Device Class IIa credentials.
3. Click **"🖨️ Print / Save as PDF"** (or press `Ctrl + P`).
4. Select **"Save as PDF"** in your browser's print dialog, set Margins to **Default**, and ensure **"Background graphics"** is checked.

---

## 📁 Project Directory Structure

```
D:\Antigravity\velourcare-case-manager\
├── assets/                  # Brand crest emblems and favicon
├── bin/                     # cloudflared.exe for secure team tunnel
├── css/
│   ├── app.css              # Main VélourCare clinical luxury styling
│   ├── case-report.css      # 3-Page printable A4 case report styles
│   └── tooth-chart.css      # Anatomical SVG tooth chart & IPR styling
├── data/
│   ├── cases.db             # SQLite database
│   └── backups/             # Automatic daily JSON backups
├── js/
│   ├── app.js               # Application coordinator & state
│   ├── tooth-chart.js       # Anatomical SVG teeth geometry generator
│   ├── movement-table.js    # 10-vector orthodontic measurement grid
│   ├── ipr-chart.js         # Interactive IPR reduction & staging
│   └── pdf-export.js        # 3-Page clinical report generator
├── uploads/                 # Uploaded smile comparison photos
├── index.html               # Single Page Application
├── server.py                # Python HTTP server & REST API
├── start_server.bat         # One-click Windows launcher
└── README.md                # Documentation
```
