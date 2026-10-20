/**
 * VélourCare Ortho — Anatomical SVG Tooth Chart Engine
 * Generates realistic dental morphology with Attachments, Power Points (P.P),
 * Buttons/Cutouts, Bite Ramps, and Interproximal Reduction (IPR).
 */

const ToothChart = (() => {
    // Upper Arch: 18..11 (Patient Right) | 21..28 (Patient Left)
    // Lower Arch: 48..41 (Patient Right) | 31..38 (Patient Left)
    const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
    const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

    function getToothType(fdi) {
        const pos = fdi % 10;
        if (pos >= 6) return 'molar';
        if (pos >= 4) return 'premolar';
        if (pos === 3) return 'canine';
        if (pos === 2) return 'lateral';
        return 'central';
    }

    function getPalmerNumber(fdi) {
        return fdi % 10;
    }

    function normalizeFeature(feat) {
        if (!feat) return { attachment: '', power_point: false, button: '', bite_ramp: false, notes: '' };
        if (typeof feat === 'string') {
            return { attachment: feat, power_point: false, button: '', bite_ramp: false, notes: '' };
        }
        return {
            attachment: feat.attachment || (typeof feat === 'string' ? feat : ''),
            power_point: !!feat.power_point,
            pp_type: feat.pp_type || '',
            button: feat.button || '',
            bite_ramp: !!feat.bite_ramp,
            notes: feat.notes || ''
        };
    }

    function formatPointTag(stage) {
        if (!stage) return 'T.1';
        const s = String(stage).trim();
        const mBefore = s.match(/before\s*(?:tray|stage|aligner)?\s*(\d+)/i);
        if (mBefore) return `T.${mBefore[1]}`;
        const mTray = s.match(/tray\s*(\d+)/i);
        if (mTray) return `T.${mTray[1]}`;
        const mStage = s.match(/stage\s*(\d+)/i);
        if (mStage) return `T.${mStage[1]}`;
        const mAligner = s.match(/aligner\s*(\d+)/i);
        if (mAligner) return `T.${mAligner[1]}`;
        if (/^\d+$/.test(s)) return `T.${s}`;
        return s.length > 5 ? s.substring(0, 4) + '.' : s;
    }

    /**
     * Anatomical 3D SVG Tooth Engine (Frontal / Facial View)
     * Matches the clinical scan reference photo (uploaded_media_1791496316863.png):
     * - Broad rectangular Upper Centrals (11, 21) with straight horizontal incisal edge
     * - Graceful slender Upper Laterals (12, 22) with rounded distoincisal curve
     * - Pointed spearhead Upper Canines (13, 23) with central labial ridge
     * - Upper Premolars (14, 15, 24, 25) with rounded buccal cusps
     * - Upper Molars (16, 17, 18, 26, 27, 28) with dual buccal cusps & buccal groove
     * - Scalloped pink gingiva collar (gums & interdental papillae) at the cervical neck
     * - Lower arch teeth (48..38) inverted with gums at bottom and incisal edges at top
     * - Specular enamel glint, developmental lobes, incisal translucency, and 3D attachments
     */
    function getToothAnatomy(fdi, isLower, isLeft) {
        const pos = fdi % 10; // 1=central, 2=lateral, 3=canine, 4,5=premolar, 6,7,8=molar
        const viewBox = "-24 -30 48 60";
        const width = 46;
        const height = 58;

        if (!isLower) {
            // ================= UPPER ARCH (MAXILLARY) =================
            if (pos === 1) {
                // UPPER CENTRAL INCISOR (11, 21)
                // Broad rectangular crown, straight incisal edge, crisp mesioincisal angle
                const body = isLeft ? 
                    `M -15 -17 C -15 -21, -8 -22, 0 -22 C 8 -22, 14 -21, 14 -17 C 15 -7, 16 7, 14 18 C 13 20.5, 11 21, 8 21 L -14 21 C -15.5 21, -16 20, -16 18 C -16.2 7, -16 -7, -15 -17 Z` :
                    `M 15 -17 C 15 -21, 8 -22, 0 -22 C -8 -22, -14 -21, -14 -17 C -15 -7, -16 7, -14 18 C -13 20.5, -11 21, -8 21 L 14 21 C 15.5 21, 16 20, 16 18 C 16.2 7, 16 -7, 15 -17 Z`;
                
                const lobes = isLeft ? 
                    [`M -5 -15 Q -5 0 -5 16`, `M 5 -15 Q 5 0 5 16`] :
                    [`M 5 -15 Q 5 0 5 16`, `M -5 -15 Q -5 0 -5 16`];
                
                const glint = isLeft ? 
                    `<ellipse cx="-3" cy="-2" rx="4.5" ry="12" fill="url(#glintGrad_${fdi})" />` :
                    `<ellipse cx="3" cy="-2" rx="4.5" ry="12" fill="url(#glintGrad_${fdi})" />`;
                
                const halo = isLeft ? 
                    `<path d="M -13 18.5 L 11 18.5" stroke="rgba(255,255,255,0.85)" stroke-width="1.2" stroke-linecap="round" />` :
                    `<path d="M -11 18.5 L 13 18.5" stroke="rgba(255,255,255,0.85)" stroke-width="1.2" stroke-linecap="round" />`;

                const gum = `M -19 -28 L 19 -28 L 19 -14 C 15 -18, 9 -22, 0 -22 C -9 -22, -15 -18, -19 -14 Z`;

                return { viewBox, width, height, body, lobes, glint, halo, gum };
            } else if (pos === 2) {
                // UPPER LATERAL INCISOR (12, 22)
                // Delicate, narrower crown with rounded distoincisal curve
                const body = isLeft ?
                    `M -11 -16 C -11 -19, -6 -20, 0 -20 C 6 -20, 10 -19, 10 -16 C 11 -7, 12 6, 9.5 16 C 8 18.5, 5 19, 2 19 L -9 19 C -10.5 19, -11.5 18, -11.5 16 C -12 6, -12 -7, -11 -16 Z` :
                    `M 11 -16 C 11 -19, 6 -20, 0 -20 C -6 -20, -10 -19, -10 -16 C -11 -7, -12 6, -9.5 16 C -8 18.5, -5 19, -2 19 L 9 19 C 10.5 19, 11.5 18, 11.5 16 C 12 6, 12 -7, 11 -16 Z`;

                const lobes = isLeft ?
                    [`M -3 -13 Q -3 0 -3 14`, `M 3 -13 Q 3 0 3 14`] :
                    [`M 3 -13 Q 3 0 3 14`, `M -3 -13 Q -3 0 -3 14`];

                const glint = isLeft ?
                    `<ellipse cx="-2" cy="-2" rx="3.5" ry="10" fill="url(#glintGrad_${fdi})" />` :
                    `<ellipse cx="2" cy="-2" rx="3.5" ry="10" fill="url(#glintGrad_${fdi})" />`;

                const halo = isLeft ?
                    `<path d="M -8 17 L 6 17" stroke="rgba(255,255,255,0.8)" stroke-width="1" stroke-linecap="round" />` :
                    `<path d="M -6 17 L 8 17" stroke="rgba(255,255,255,0.8)" stroke-width="1" stroke-linecap="round" />`;

                const gum = `M -15 -28 L 15 -28 L 15 -13 C 11 -17, 6 -20, 0 -20 C -6 -20, -11 -17, -15 -13 Z`;

                return { viewBox, width, height, body, lobes, glint, halo, gum };
            } else if (pos === 3) {
                // UPPER CANINE (13, 23)
                // Spearhead cusp tip with central labial ridge
                const body = isLeft ?
                    `M -12 -16 C -12 -19, -6 -20.5, 0 -20.5 C 6 -20.5, 12 -19, 12 -16 C 13 -7, 14 5, 12 14 C 10 17, 4 20.5, 0 22 C -4 19.5, -9 16, -11.5 14 C -13 5, -13 -7, -12 -16 Z` :
                    `M 12 -16 C 12 -19, 6 -20.5, 0 -20.5 C -6 -20.5, -12 -19, -12 -16 C -13 -7, -14 5, -12 14 C -10 17, -4 20.5, 0 22 C 4 19.5, 9 16, 11.5 14 C 13 5, 13 -7, 12 -16 Z`;

                const lobes = isLeft ?
                    [`M 0 -16 L 0 21`, `M -5 -8 Q -4 4 -4 12`, `M 5 -8 Q 4 4 4 12`] :
                    [`M 0 -16 L 0 21`, `M 5 -8 Q 4 4 4 12`, `M -5 -8 Q -4 4 -4 12`];

                const glint = `<ellipse cx="0" cy="-2" rx="3.2" ry="12" fill="url(#glintGrad_${fdi})" />`;
                const halo = isLeft ?
                    `<path d="M -6 16 L 0 21 L 6 16" stroke="rgba(255,255,255,0.85)" stroke-width="1.1" stroke-linecap="round" fill="none" />` :
                    `<path d="M 6 16 L 0 21 L -6 16" stroke="rgba(255,255,255,0.85)" stroke-width="1.1" stroke-linecap="round" fill="none" />`;

                const gum = `M -16 -28 L 16 -28 L 16 -13 C 12 -17, 6 -20.5, 0 -20.5 C -6 -20.5, -12 -17, -16 -13 Z`;

                return { viewBox, width, height, body, lobes, glint, halo, gum };
            } else if (pos === 4 || pos === 5) {
                // UPPER PREMOLARS (14, 15, 24, 25)
                // Rounded buccal cusp with curved shoulders
                const body = `M -12 -15 C -12 -18, -6 -19.5, 0 -19.5 C 6 -19.5, 12 -18, 12 -15 C 13 -6, 13.5 5, 11 13 C 8 16, 4 17.5, 0 18.5 C -4 17.5, -8 16, -11 13 C -13.5 5, -13 -6, -12 -15 Z`;
                const lobes = [`M 0 -15 L 0 17`, `M -6 -6 Q -4 3 -4 10`, `M 6 -6 Q 4 3 4 10`];
                const glint = `<ellipse cx="0" cy="-2" rx="3.8" ry="10" fill="url(#glintGrad_${fdi})" />`;
                const halo = `<path d="M -5 14 L 0 17.5 L 5 14" stroke="rgba(255,255,255,0.75)" stroke-width="1" stroke-linecap="round" fill="none" />`;
                const gum = `M -16 -28 L 16 -28 L 16 -12 C 12 -16, 6 -19.5, 0 -19.5 C -6 -19.5, -12 -16, -16 -12 Z`;

                return { viewBox, width, height, body, lobes, glint, halo, gum };
            } else {
                // UPPER MOLARS (16, 17, 18, 26, 27, 28)
                // Broad multi-cusped crown with buccal groove
                const body = isLeft ?
                    `M -17 -15 C -17 -18, -8 -19.5, 0 -19.5 C 8 -19.5, 17 -18, 17 -15 C 18 -6, 18 5, 16 12 C 14 14.5, 10 15, 7 15 C 4 15, 2 13.5, 0 13 C -2 13.5, -4 15.5, -8 15.5 C -12 15.5, -15 14, -16 12 C -18 5, -18 -6, -17 -15 Z` :
                    `M 17 -15 C 17 -18, 8 -19.5, 0 -19.5 C -8 -19.5, -17 -18, -17 -15 C -18 -6, -18 5, -16 12 C -14 14.5, -10 15, -7 15 C -4 15, -2 13.5, 0 13 C 2 13.5, 4 15.5, 8 15.5 C 12 15.5, 15 14, 16 12 C 18 5, 18 -6, 17 -15 Z`;

                const lobes = isLeft ?
                    [`M 0 13 L 0 -2`, `M -7 -13 Q -7 0 -7 11`, `M 7 -13 Q 7 0 7 11`] :
                    [`M 0 13 L 0 -2`, `M 7 -13 Q 7 0 7 11`, `M -7 -13 Q -7 0 -7 11`];

                const glint = `<ellipse cx="-4" cy="-2" rx="4.5" ry="9" fill="url(#glintGrad_${fdi})" />`;
                const halo = `<path d="M -12 13 Q -8 15 -4 13 M 4 13 Q 8 15 12 13" stroke="rgba(255,255,255,0.75)" stroke-width="1" stroke-linecap="round" fill="none" />`;
                const gum = `M -21 -28 L 21 -28 L 21 -12 C 16 -16, 8 -19.5, 0 -19.5 C -8 -19.5, -16 -16, -21 -12 Z`;

                return { viewBox, width, height, body, lobes, glint, halo, gum };
            }
        } else {
            // ================= LOWER ARCH (MANDIBULAR) =================
            // Cervical neck at bottom (+), incisal/occlusal edge at top (-)
            if (pos === 1) {
                // LOWER CENTRAL (31, 41) - Slender symmetrical chisel
                const body = `M -8 16 C -8 19, -4 20, 0 20 C 4 20, 8 19, 8 16 C 9 8, 9 -5, 8.5 -16 L -8.5 -16 C -9 -5, -9 8, -8 16 Z`;
                const lobes = [`M -2 14 L -2 -13`, `M 2 14 L 2 -13`];
                const glint = `<ellipse cx="-1" cy="0" rx="2.5" ry="9" fill="url(#glintGrad_${fdi})" />`;
                const halo = `<path d="M -7 -14.5 L 7 -14.5" stroke="rgba(255,255,255,0.85)" stroke-width="1" stroke-linecap="round" />`;
                const gum = `M -12 28 L 12 28 L 12 13 C 8 17, 4 20, 0 20 C -4 20, -8 17, -12 13 Z`;

                return { viewBox, width, height, body, lobes, glint, halo, gum };
            } else if (pos === 2) {
                // LOWER LATERAL (32, 42) - Slightly wider with rounded distoincisal angle
                const body = isLeft ?
                    `M -9 16 C -9 19, -5 20, 0 20 C 5 20, 9.5 19, 9.5 16 C 10.5 7, 11 -4, 9.5 -16 C 8.5 -17.5, 6 -17.5, 3 -17.5 L -9.5 -17.5 C -10.5 -17.5, -11 -16, -11 -14 C -11 6, -10 10, -9 16 Z` :
                    `M 9 16 C 9 19, 5 20, 0 20 C -5 20, -9.5 19, -9.5 16 C -10.5 7, -11 -4, -9.5 -16 C -8.5 -17.5, -6 -17.5, -3 -17.5 L 9.5 -17.5 C 10.5 -17.5, 11 -16, 11 -14 C 11 6, 10 10, 9 16 Z`;

                const lobes = [`M -2 14 L -2 -14`, `M 2 14 L 2 -14`];
                const glint = `<ellipse cx="0" cy="0" rx="3" ry="10" fill="url(#glintGrad_${fdi})" />`;
                const halo = `<path d="M -8 -15.5 L 8 -15.5" stroke="rgba(255,255,255,0.8)" stroke-width="1" stroke-linecap="round" />`;
                const gum = `M -13 28 L 13 28 L 13 13 C 9 17, 5 20, 0 20 C -5 20, -9 17, -13 13 Z`;

                return { viewBox, width, height, body, lobes, glint, halo, gum };
            } else if (pos === 3) {
                // LOWER CANINE (33, 43) - Cusp tip pointing upward
                const body = `M -11 16 C -11 19, -5 20.5, 0 20.5 C 5 20.5, 11 19, 11 16 C 12 7, 13 -4, 10 -13 C 8 -16, 4 -19, 0 -21 C -4 -19, -8 -16, -10 -13 C -13 -4, -12 7, -11 16 Z`;
                const lobes = [`M 0 16 L 0 -19`, `M -4 8 Q -3 -4 -3 -11`, `M 4 8 Q 3 -4 3 -11`];
                const glint = `<ellipse cx="0" cy="0" rx="3.2" ry="11" fill="url(#glintGrad_${fdi})" />`;
                const halo = `<path d="M -5 -15 L 0 -19.5 L 5 -15" stroke="rgba(255,255,255,0.85)" stroke-width="1.1" stroke-linecap="round" fill="none" />`;
                const gum = `M -15 28 L 15 28 L 15 13 C 11 17, 5 20.5, 0 20.5 C -5 20.5, -11 17, -15 13 Z`;

                return { viewBox, width, height, body, lobes, glint, halo, gum };
            } else if (pos === 4 || pos === 5) {
                // LOWER PREMOLARS (34, 35, 44, 45) - Rounded buccal cusp pointing upward
                const body = `M -11 15 C -11 18, -5 19.5, 0 19.5 C 5 19.5, 11 18, 11 15 C 12.5 6, 12 -4, 10 -12 C 7 -15, 4 -16.5, 0 -17.5 C -4 -16.5, -7 -15, -10 -12 C -12 -4, -12.5 6, -11 15 Z`;
                const lobes = [`M 0 15 L 0 -16`, `M -5 6 Q -3 -3 -3 -9`, `M 5 6 Q 3 -3 3 -9`];
                const glint = `<ellipse cx="0" cy="0" rx="3.5" ry="9" fill="url(#glintGrad_${fdi})" />`;
                const halo = `<path d="M -5 -13.5 L 0 -16.5 L 5 -13.5" stroke="rgba(255,255,255,0.75)" stroke-width="1" stroke-linecap="round" fill="none" />`;
                const gum = `M -15 28 L 15 28 L 15 12 C 11 16, 5 19.5, 0 19.5 C -5 19.5, -11 16, -15 12 Z`;

                return { viewBox, width, height, body, lobes, glint, halo, gum };
            } else {
                // LOWER MOLARS (36, 37, 38, 46, 47, 48) - Broad buccal crown pointing upward
                const body = `M -16 15 C -16 18, -8 19.5, 0 19.5 C 8 19.5, 16 18, 16 15 C 17 6, 17 -4, 15 -11 C 13 -13.5, 10 -14, 7 -14 C 4 -14, 2 -12.5, 0 -12 C -2 -12.5, -4 -14.5, -8 -14.5 C -12 -14.5, -15 -13, -15 -11 C -17 -4, -17 6, -16 15 Z`;
                const lobes = [`M 0 -12 L 0 3`, `M -7 13 Q -7 0 -7 -10`, `M 7 13 Q 7 0 7 -10`];
                const glint = `<ellipse cx="-3" cy="0" rx="4.5" ry="9" fill="url(#glintGrad_${fdi})" />`;
                const halo = `<path d="M -11 -12 Q -7 -14 -3 -12 M 3 -12 Q 7 -14 11 -12" stroke="rgba(255,255,255,0.75)" stroke-width="1" stroke-linecap="round" fill="none" />`;
                const gum = `M -20 28 L 20 28 L 20 12 C 15 16, 8 19.5, 0 19.5 C -8 19.5, -15 16, -20 12 Z`;

                return { viewBox, width, height, body, lobes, glint, halo, gum };
            }
        }
    }

    /**
     * 3D Brick Attachment Graphic Shapes
     * Renders photorealistic 3D composite resin bricks/blocks with:
     * - Contact drop-shadow onto enamel
     * - Dark base perimeter rim
     * - Illuminated top & left chamfer bevels (light from top-left)
     * - Shaded right & bottom chamfer bevels (shadow)
     * - Raised front face plateau with specular composite glints
     */
    function getAttachmentShapeSVG(attType) {
        if (!attType) return '';
        const t = attType.toLowerCase();

        if (t.includes('horizontal') && (t.includes('ellipsoid') || t.includes('oval'))) {
            // Horizontal Ellipsoid / Oval 3D Dome Brick
            return `
                <g class="attachment-3d-glyph" title="Attachment: ${attType}">
                    <!-- Contact Drop Shadow onto Tooth Enamel -->
                    <ellipse cx="1.0" cy="1.0" rx="9.0" ry="5.4" fill="rgba(10, 25, 47, 0.45)" />
                    <!-- Dark Base Rim Foundation -->
                    <ellipse cx="0" cy="0" rx="8.8" ry="5.2" fill="#172554" stroke="#0F172A" stroke-width="0.5" />
                    <!-- 3D Beveled Outer Flank -->
                    <ellipse cx="0" cy="0.4" rx="7.8" ry="4.4" fill="#1E40AF" />
                    <!-- Raised Dome Body -->
                    <ellipse cx="-0.2" cy="-0.4" rx="6.8" ry="3.8" fill="#2563EB" stroke="#1D4ED8" stroke-width="0.5" />
                    <!-- 3D Spherical Light Highlight Crest -->
                    <ellipse cx="-2.0" cy="-1.5" rx="4.2" ry="2.0" fill="#93C5FD" opacity="0.85" />
                    <!-- Crisp White Specular Glint -->
                    <ellipse cx="-2.6" cy="-1.8" rx="2.0" ry="0.9" fill="#FFFFFF" opacity="0.95" />
                </g>
            `;
        } else if (t.includes('horizontal')) {
            // Horizontal Rectangular 3D Brick
            return `
                <g class="attachment-3d-glyph" title="Attachment: ${attType}">
                    <!-- Contact Drop Shadow onto Tooth Enamel -->
                    <rect x="-8.2" y="-4.2" width="18.8" height="10.8" rx="1.8" fill="rgba(10, 25, 47, 0.45)" />
                    <!-- Dark Base Foundation -->
                    <rect x="-9.2" y="-5.2" width="18.4" height="10.4" rx="1.6" fill="#172554" stroke="#0F172A" stroke-width="0.5" />
                    <!-- Top Bevel (Highlight Face) -->
                    <polygon points="-9.2,-5.2 9.2,-5.2 6.8,-3.4 -6.8,-3.4" fill="#93C5FD" />
                    <!-- Left Bevel (Light Reflected Face) -->
                    <polygon points="-9.2,-5.2 -6.8,-3.4 -6.8,3.4 -9.2,5.2" fill="#60A5FA" />
                    <!-- Right Bevel (Shadowed Face) -->
                    <polygon points="9.2,-5.2 6.8,-3.4 6.8,3.4 9.2,5.2" fill="#1E40AF" />
                    <!-- Bottom Bevel (Deep Shadow Face) -->
                    <polygon points="-9.2,5.2 9.2,5.2 6.8,3.4 -6.8,3.4" fill="#1E3A8A" />
                    <!-- Raised Front Plateau (Main Brick Face) -->
                    <rect x="-6.8" y="-3.4" width="13.6" height="6.8" rx="0.9" fill="#2563EB" stroke="#1D4ED8" stroke-width="0.5" />
                    <!-- Front Face Specular Sheen -->
                    <rect x="-6.0" y="-2.6" width="12.0" height="2.2" rx="0.5" fill="#60A5FA" opacity="0.65" />
                    <!-- Specular Ridge Highlights (3D Glint) -->
                    <path d="M -6.8 3.0 L -6.8 -3.4 L 6.2 -3.4" stroke="#FFFFFF" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" fill="none" />
                    <circle cx="-5.0" cy="-2.0" r="0.8" fill="#FFFFFF" opacity="0.95" />
                </g>
            `;
        } else if (t.includes('beveled')) {
            // Beveled 3D Wedge Brick (Orthodontic Ramp/Shelf)
            return `
                <g class="attachment-3d-glyph" title="Attachment: ${attType}">
                    <!-- Contact Drop Shadow onto Tooth Enamel -->
                    <polygon points="-4.2,-8.2 6.2,-8.2 6.2,9.2 -4.2,9.2" fill="rgba(10, 25, 47, 0.45)" />
                    <!-- Dark Base Foundation -->
                    <polygon points="-5.2,-9.2 5.2,-9.2 5.2,8.2 -5.2,8.2" fill="#172554" stroke="#0F172A" stroke-width="0.5" />
                    <!-- Active 90-degree Extrusion Shelf (Top Highlight) -->
                    <polygon points="-5.2,-9.2 5.2,-9.2 3.4,-6.8 -3.4,-6.8" fill="#93C5FD" />
                    <!-- 3D Sloping Wedge Ramp Face -->
                    <polygon points="-3.4,-6.8 3.4,-6.8 4.6,6.8 -4.6,6.8" fill="#2563EB" stroke="#1D4ED8" stroke-width="0.5" />
                    <!-- Left Wedge Flank (Light Side) -->
                    <polygon points="-5.2,-9.2 -3.4,-6.8 -4.6,6.8 -5.2,8.2" fill="#60A5FA" />
                    <!-- Right Wedge Flank (Shadow Side) -->
                    <polygon points="5.2,-9.2 3.4,-6.8 4.6,6.8 5.2,8.2" fill="#1E40AF" />
                    <!-- Bottom Shelf -->
                    <polygon points="-5.2,8.2 5.2,8.2 4.6,6.8 -4.6,6.8" fill="#1E3A8A" />
                    <!-- Specular Active Edge Lines -->
                    <line x1="-5.0" y1="-9.2" x2="5.0" y2="-9.2" stroke="#FFFFFF" stroke-width="1.0" stroke-linecap="round" opacity="0.95" />
                    <line x1="-3.4" y1="-6.8" x2="3.4" y2="-6.8" stroke="#BFDBFE" stroke-width="0.8" opacity="0.9" />
                    <line x1="-2.8" y1="-5.5" x2="-3.8" y2="5.0" stroke="#93C5FD" stroke-width="0.8" opacity="0.75" />
                </g>
            `;
        } else if (t.includes('triangular')) {
            // Triangular 3D Brick (Root & Torque Control)
            return `
                <g class="attachment-3d-glyph" title="Attachment: ${attType}">
                    <!-- Contact Drop Shadow -->
                    <polygon points="1.0,-9.2 8.8,9.2 -6.8,9.2" fill="rgba(10, 25, 47, 0.45)" />
                    <!-- Dark Base Foundation -->
                    <polygon points="0,-10.2 7.8,8.2 -7.8,8.2" fill="#172554" stroke="#0F172A" stroke-width="0.5" />
                    <!-- Left Facet (Light Side) -->
                    <polygon points="0,-10.2 -7.8,8.2 -5.0,6.2 0,-7.2" fill="#60A5FA" />
                    <!-- Right Facet (Shadow Side) -->
                    <polygon points="0,-10.2 7.8,8.2 5.0,6.2 0,-7.2" fill="#1E40AF" />
                    <!-- Bottom Facet -->
                    <polygon points="-7.8,8.2 7.8,8.2 5.0,6.2 -5.0,6.2" fill="#1E3A8A" />
                    <!-- Raised Triangular Face -->
                    <polygon points="0,-7.2 5.0,6.2 -5.0,6.2" fill="#2563EB" stroke="#1D4ED8" stroke-width="0.5" />
                    <!-- Specular Ridge Lines -->
                    <line x1="0" y1="-10.2" x2="0" y2="-7.2" stroke="#FFFFFF" stroke-width="1.0" stroke-linecap="round" opacity="0.95" />
                    <line x1="0" y1="-7.2" x2="-4.2" y2="5.5" stroke="#FFFFFF" stroke-width="0.8" opacity="0.9" />
                </g>
            `;
        } else if (t.includes('root') || t.includes('dual')) {
            // Root Control / Dual Bevel 3D Brick
            return `
                <g class="attachment-3d-glyph" title="Attachment: ${attType}">
                    <!-- Contact Drop Shadow -->
                    <rect x="-4.2" y="-8.2" width="10.8" height="18.8" rx="1.8" fill="rgba(10, 25, 47, 0.45)" />
                    <!-- Dark Base Foundation -->
                    <rect x="-5.2" y="-9.2" width="10.4" height="18.4" rx="1.6" fill="#172554" stroke="#0F172A" stroke-width="0.5" />
                    <!-- Upper Beveled Facet (Light) -->
                    <polygon points="-5.2,-9.2 5.2,-9.2 3.6,0 -3.6,0" fill="#60A5FA" />
                    <!-- Lower Beveled Facet (Shadow) -->
                    <polygon points="-3.6,0 3.6,0 5.2,9.2 -5.2,9.2" fill="#1E40AF" />
                    <!-- Side Chamfers -->
                    <polygon points="-5.2,-9.2 -3.6,0 -5.2,9.2" fill="#93C5FD" opacity="0.8" />
                    <polygon points="5.2,-9.2 3.6,0 5.2,9.2" fill="#172554" />
                    <!-- Central 3D Ridge Ledge -->
                    <line x1="-3.6" y1="0" x2="3.6" y2="0" stroke="#FFFFFF" stroke-width="1.0" stroke-linecap="round" opacity="0.95" />
                    <line x1="-5.0" y1="-9.2" x2="5.0" y2="-9.2" stroke="#BFDBFE" stroke-width="0.8" opacity="0.9" />
                </g>
            `;
        } else if (t.includes('rotation')) {
            // Optimized Rotation 3D Brick
            return `
                <g class="attachment-3d-glyph" title="Attachment: ${attType}">
                    <!-- Contact Drop Shadow -->
                    <rect x="-4.2" y="-8.2" width="10.8" height="18.8" rx="2.0" fill="rgba(10, 25, 47, 0.45)" />
                    <!-- Dark Base Foundation -->
                    <rect x="-5.2" y="-9.2" width="10.4" height="18.4" rx="1.8" fill="#172554" stroke="#0F172A" stroke-width="0.5" />
                    <!-- Active Asymmetrical Push Face -->
                    <polygon points="-5.2,-9.2 5.2,-9.2 2.0,-6.0 -4.0,-6.0" fill="#93C5FD" />
                    <!-- Main Body Ramp -->
                    <polygon points="-4.0,-6.0 2.0,-6.0 4.2,7.0 -3.0,7.0" fill="#2563EB" stroke="#1D4ED8" stroke-width="0.5" />
                    <!-- Lateral Bevels -->
                    <polygon points="-5.2,-9.2 -4.0,-6.0 -3.0,7.0 -5.2,9.2" fill="#60A5FA" />
                    <polygon points="5.2,-9.2 2.0,-6.0 4.2,7.0 5.2,9.2" fill="#1E40AF" />
                    <polygon points="-5.2,9.2 5.2,9.2 4.2,7.0 -3.0,7.0" fill="#1E3A8A" />
                    <!-- Specular Edge -->
                    <path d="M -4.0 -6.0 L 2.0 -6.0 L 4.2 7.0" stroke="#FFFFFF" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" fill="none" />
                </g>
            `;
        } else {
            // Vertical Rectangular 3D Brick (Standard)
            return `
                <g class="attachment-3d-glyph" title="Attachment: ${attType}">
                    <!-- Contact Drop Shadow onto Tooth Enamel -->
                    <rect x="-4.2" y="-8.2" width="10.8" height="18.8" rx="1.8" fill="rgba(10, 25, 47, 0.45)" />
                    <!-- Dark Base Foundation -->
                    <rect x="-5.2" y="-9.2" width="10.4" height="18.4" rx="1.6" fill="#172554" stroke="#0F172A" stroke-width="0.5" />
                    <!-- Top Bevel (Highlight Face) -->
                    <polygon points="-5.2,-9.2 5.2,-9.2 3.4,-6.8 -3.4,-6.8" fill="#93C5FD" />
                    <!-- Left Bevel (Light Reflected Face) -->
                    <polygon points="-5.2,-9.2 -3.4,-6.8 -3.4,6.8 -5.2,9.2" fill="#60A5FA" />
                    <!-- Right Bevel (Shadowed Face) -->
                    <polygon points="5.2,-9.2 3.4,-6.8 3.4,6.8 5.2,9.2" fill="#1E40AF" />
                    <!-- Bottom Bevel (Deep Shadow Face) -->
                    <polygon points="-5.2,9.2 5.2,9.2 3.4,6.8 -3.4,6.8" fill="#1E3A8A" />
                    <!-- Raised Front Plateau (Main Brick Face) -->
                    <rect x="-3.4" y="-6.8" width="6.8" height="13.6" rx="0.9" fill="#2563EB" stroke="#1D4ED8" stroke-width="0.5" />
                    <!-- Front Face Specular Sheen -->
                    <rect x="-2.6" y="-6.0" width="2.2" height="12.0" rx="0.5" fill="#60A5FA" opacity="0.65" />
                    <!-- Specular Ridge Highlights (3D Glint) -->
                    <path d="M -3.4 6.2 L -3.4 -6.8 L 3.0 -6.8" stroke="#FFFFFF" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" fill="none" />
                    <circle cx="-2.0" cy="-5.0" r="0.8" fill="#FFFFFF" opacity="0.95" />
                </g>
            `;
        }
    }

    /**
     * Generates the SVG Markup for an individual tooth with clinical markers
     */
    function createToothSVG(fdi, isLower, options = {}) {
        const type = getToothType(fdi);
        const feat = normalizeFeature(options.feature);
        const hasAttachment = !!feat.attachment;
        const hasPP = !!feat.power_point;
        const hasButton = !!feat.button;
        const hasBiteRamp = !!feat.bite_ramp;

        // Attachment SVG
        const attachmentSVG = hasAttachment ? getAttachmentShapeSVG(feat.attachment) : '';

        // Power Point / Pressure Ridge
        const powerPointSVG = hasPP ? `
            <g class="power-point-glyph" title="Power Point (P.P)" transform="translate(0, -18)">
                <path d="M -7 0 Q 0 -3 7 0" stroke="#0284C7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                <circle cx="0" cy="-1.5" r="2.2" fill="#38BDF8" stroke="#0284C7" stroke-width="0.6" />
            </g>
        ` : '';

        // Button / Cutout
        const buttonSVG = hasButton ? `
            <g class="button-glyph" title="Button / Cutout" transform="translate(0, -12)">
                <circle cx="8" cy="0" r="4.2" fill="#7C3AED" stroke="#FFFFFF" stroke-width="1.2" />
                <circle cx="8" cy="0" r="1.6" fill="#FFFFFF" />
            </g>
        ` : '';

        // Bite Ramp
        const rampSVG = hasBiteRamp ? `
            <g class="ramp-glyph" title="Bite Ramp" transform="translate(0, -6)">
                <polygon points="-5,0 0,5 5,0" fill="#0D9488" stroke="#FFFFFF" stroke-width="0.8" />
            </g>
        ` : '';

        // Exact 3D Photorealistic Tooth & Root image from reference scan
        const toothImgSrc = (typeof window !== 'undefined' && window.TOOTH_ASSETS && window.TOOTH_ASSETS[fdi]) 
            ? window.TOOTH_ASSETS[fdi] 
            : `assets/teeth/tooth_${fdi}.png`;

        const isUpperCentral = !isLower && (fdi === 11 || fdi === 21);
        const svgBox = isUpperCentral ? 'viewBox="-30 -38 60 76"' : 'viewBox="-26 -36 52 72"';
        const imgX = isUpperCentral ? '-30' : '-26';
        const imgY = isUpperCentral ? '-38' : '-36';
        const imgW = isUpperCentral ? '60' : '52';
        const imgH = isUpperCentral ? '76' : '72';
        const centralClass = isUpperCentral ? 'maxillary-central' : '';

        return `
            <svg ${svgBox} class="tooth-svg ${type} ${centralClass}" preserveAspectRatio="xMidYMid meet">
                <!-- Exact 3D Anatomical Tooth Crown & Roots from Clinical Reference -->
                <image href="${toothImgSrc}" xlink:href="${toothImgSrc}" 
                       x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" 
                       preserveAspectRatio="xMidYMid meet" 
                       class="tooth-root-image ${centralClass}" />

                <!-- Clinical Features & Attachments Overlay on Enamel Crown -->
                <g class="tooth-clinical-overlay" transform="translate(0, -12)">
                    ${attachmentSVG}
                </g>
                ${powerPointSVG}
                ${rampSVG}
                ${buttonSVG}
            </svg>
        `;
    }

    /**
     * Renders a full anatomical dental arch with interdental IPR contacts and feature badges
     */
    function renderArch({ container, isLower = false, iprData = {}, attachments = {}, onIprClick = null, onToothClick = null, readOnly = false }) {
        const teeth = isLower ? LOWER_TEETH : UPPER_TEETH;
        const archId = isLower ? 'lower' : 'upper';

        let html = `
            <div class="teeth-row" data-arch="${archId}">
        `;

        for (let i = 0; i < teeth.length; i++) {
            const fdi = teeth[i];
            const palmer = getPalmerNumber(fdi);
            const type = getToothType(fdi);
            const feat = normalizeFeature(attachments[fdi]);

            const hasAtt = !!feat.attachment;
            const hasPP = !!feat.power_point;
            const hasBtn = !!feat.button;
            const hasRamp = !!feat.bite_ramp;

            // Badges string
            let badgesHtml = '';
            if (hasAtt) badgesHtml += `<span class="badge-mini badge-att" title="Attachment: ${feat.attachment}">ATT</span>`;
            if (hasPP) badgesHtml += `<span class="badge-mini badge-pp" title="Power Point P.P">PP</span>`;
            if (hasBtn) badgesHtml += `<span class="badge-mini badge-btn" title="Button / Cutout: ${feat.button}">BTN</span>`;
            if (hasRamp) badgesHtml += `<span class="badge-mini badge-ramp" title="Bite Ramp">RAMP</span>`;

            // Tooth Element
            html += `
                <div class="tooth-unit ${hasAtt ? 'has-attachment' : ''} ${hasPP ? 'has-pp' : ''} ${hasBtn ? 'has-btn' : ''}" 
                     data-fdi="${fdi}" 
                     title="Tooth ${fdi} (${type}) — Click to configure Attachments, Powers, Buttons">
                    <span class="tooth-number-tag" title="Palmer #${palmer} • FDI #${fdi}">${palmer} <small style="opacity:0.65;font-size:0.6rem;">(${fdi})</small></span>
                    <div class="tooth-svg-box ${type}">
                        ${createToothSVG(fdi, isLower, { feature: feat })}
                    </div>
                    <div class="tooth-feature-pills-row">
                        ${badgesHtml || '<span class="pill-empty">·</span>'}
                    </div>
                </div>
            `;

            // Interdental IPR contact between teeth
            if (i < teeth.length - 1) {
                const nextFdi = teeth[i + 1];
                const isMidline = (fdi === 11 && nextFdi === 21) || (fdi === 41 && nextFdi === 31);
                const contactKey = `${fdi}-${nextFdi}`;
                const iprItem = iprData[contactKey] || null;

                const hasIpr = iprItem && parseFloat(iprItem.amount) > 0;
                const isHeavy = hasIpr && parseFloat(iprItem.amount) >= 0.4;
                const pointTag = hasIpr ? formatPointTag(iprItem.stage) : '';

                html += `
                    <div class="ipr-contact-slot ${hasIpr ? 'active' : ''} ${isHeavy ? 'heavy' : ''}" 
                         data-contact="${contactKey}" 
                         data-arch="${archId}"
                         title="Interdental Contact: ${fdi} / ${nextFdi} — ${hasIpr ? `${iprItem.amount}mm at ${iprItem.stage || 'Stage 1'}` : 'Click to configure IPR'}">
                        ${hasIpr ? `
                            <span class="ipr-point-tag-top" title="Application Point: ${iprItem.stage || 'Stage 1'}">${pointTag}</span>
                            <div class="ipr-cutting-bar" title="Cut: ${iprItem.amount}mm"></div>
                            <span class="ipr-amount-tag-bottom">${iprItem.amount}mm</span>
                        ` : `
                            <button type="button" class="ipr-trigger-btn" ${readOnly ? 'disabled style="pointer-events:none;"' : ''}>+</button>
                        `}
                    </div>
                `;

                if (isMidline) {
                    html += `<div class="arch-midline-indicator" title="Dental Midline"></div>`;
                }
            }
        }

        html += `</div>`;
        container.innerHTML = html;

        // Event listeners (if not read-only)
        if (!readOnly) {
            if (onIprClick) {
                container.querySelectorAll('.ipr-contact-slot').forEach(slot => {
                    slot.addEventListener('click', (e) => {
                        const contact = slot.getAttribute('data-contact');
                        const arch = slot.getAttribute('data-arch');
                        onIprClick({ contact, arch, existing: iprData[contact] || null });
                    });
                });
            }

            if (onToothClick) {
                container.querySelectorAll('.tooth-unit').forEach(unit => {
                    unit.addEventListener('click', (e) => {
                        const fdi = parseInt(unit.getAttribute('data-fdi'), 10);
                        onToothClick({ fdi, arch: archId, feature: normalizeFeature(attachments[fdi]) });
                    });
                });
            }
        }
    }

    /**
     * Renders a static / printable dual dental arch (Upper + Lower) for Page 1 Treatment Overview
     */
    function renderOverviewDualArchHTML(caseData) {
        const c = caseData || {};
        const attachments = c.attachments || {};
        const upperIpr = c.upper_ipr || {};
        const lowerIpr = c.lower_ipr || {};

        // Normalize attachments (only teeth with explicitly assigned features)
        const normAttachments = {};
        UPPER_TEETH.forEach(t => {
            normAttachments[t] = normalizeFeature(attachments[t]);
        });
        LOWER_TEETH.forEach(t => {
            normAttachments[t] = normalizeFeature(attachments[t]);
        });

        function buildArchRow(teeth, isLower, iprData) {
            let rowHtml = `<div class="report-arch-row">`;
            for (let i = 0; i < teeth.length; i++) {
                const fdi = teeth[i];
                const palmer = getPalmerNumber(fdi);
                const feat = normAttachments[fdi];
                const type = getToothType(fdi);

                let badges = '';
                if (feat.attachment) badges += `<span class="report-badge-att">ATT</span>`;
                if (feat.power_point) badges += `<span class="report-badge-pp">PP</span>`;
                if (feat.button) badges += `<span class="report-badge-btn">BTN</span>`;
                if (feat.bite_ramp) badges += `<span class="report-badge-ramp">R</span>`;

                rowHtml += `
                    <div class="report-tooth-box ${isLower ? 'lower' : 'upper'} ${type}" data-fdi="${fdi}">
                        <span class="report-palmer-num">${palmer}</span>
                        <div class="report-tooth-svg-wrap">
                            ${createToothSVG(fdi, isLower, { feature: feat })}
                        </div>
                        <div class="report-badge-strip">${badges || '<span style="opacity:0.25;">·</span>'}</div>
                    </div>
                `;

                if (i < teeth.length - 1) {
                    const nextFdi = teeth[i + 1];
                    const isMidline = (fdi === 11 && nextFdi === 21) || (fdi === 41 && nextFdi === 31);
                    const contactKey = `${fdi}-${nextFdi}`;
                    const ipr = iprData[contactKey];
                    const hasIpr = ipr && parseFloat(ipr.amount) > 0;
                    const stageTag = hasIpr ? formatPointTag(ipr.stage) : '';

                    rowHtml += `
                        <div class="report-ipr-slot ${hasIpr ? 'has-ipr' : ''}">
                            ${hasIpr ? `
                                <span class="report-ipr-stage-tag" title="Application Point: ${ipr.stage || 'Stage 1'}">${stageTag}</span>
                                <div class="report-ipr-bar" title="Cut: ${ipr.amount}mm"></div>
                                <span class="report-ipr-val">${ipr.amount}</span>
                            ` : ''}
                        </div>
                    `;

                    if (isMidline) {
                        rowHtml += `<div class="report-midline-line"></div>`;
                    }
                }
            }
            rowHtml += `</div>`;
            return rowHtml;
        }

        // Summary Lists for Attachments, Powers, Buttons, and IPR
        const attList = [];
        const ppList = [];
        const btnList = [];
        const rampList = [];

        [...UPPER_TEETH, ...LOWER_TEETH].forEach(t => {
            const feat = normAttachments[t];
            if (feat.attachment) attList.push(`<strong>${t}</strong> (${feat.attachment})`);
            if (feat.power_point) ppList.push(`${t}`);
            if (feat.button) btnList.push(`<strong>${t}</strong> (${feat.button})`);
            if (feat.bite_ramp) rampList.push(`${t}`);
        });

        const upperIprList = Object.keys(upperIpr)
            .filter(k => parseFloat(upperIpr[k].amount) > 0)
            .map(k => `${k} (${upperIpr[k].amount}mm ${upperIpr[k].stage || 'St.1'})`);

        const lowerIprList = Object.keys(lowerIpr)
            .filter(k => parseFloat(lowerIpr[k].amount) > 0)
            .map(k => `${k} (${lowerIpr[k].amount}mm ${lowerIpr[k].stage || 'St.1'})`);

        return `
            <div class="overview-dual-arch-container">
                <div class="overview-arch-labels">
                    <span style="font-weight:700;">RIGHT (PATIENT)</span>
                    <span style="font-family:var(--font-mono);font-size:0.75rem;color:var(--color-brand-600);font-weight:700;">MAXILLARY & MANDIBULAR DENTAL ARCH</span>
                    <span style="font-weight:700;">LEFT (PATIENT)</span>
                </div>

                <!-- Upper Arch -->
                <div class="overview-arch-block">
                    <div class="overview-arch-eyebrow">UPPER ARCH (18 .. 28)</div>
                    ${buildArchRow(UPPER_TEETH, false, upperIpr)}
                </div>

                <div class="arch-horizontal-divider"></div>

                <!-- Lower Arch -->
                <div class="overview-arch-block">
                    <div class="overview-arch-eyebrow">LOWER ARCH (48 .. 38)</div>
                    ${buildArchRow(LOWER_TEETH, true, lowerIpr)}
                </div>

                <!-- Clinical Feature Legend / Mentions -->
                <div class="overview-features-legend">
                    <div class="legend-row">
                        <div class="legend-label">🧲 Attachments:</div>
                        <div class="legend-content">
                            ${attList.length > 0 ? attList.join(', ') : '<em>None assigned</em>'}
                        </div>
                    </div>
                    <div class="legend-row">
                        <div class="legend-label">⚡ Power Points (P.P):</div>
                        <div class="legend-content">
                            ${ppList.length > 0 ? `Teeth: ${ppList.join(', ')} • <em>${c.pp_upper || c.pp_lower ? `(Staging P.P: ${c.pp_upper || c.pp_lower})` : 'Torque Ridge Protocol'}</em>` : (c.pp_upper ? `Upper Arch P.P: ${c.pp_upper} • Lower Arch P.P: ${c.pp_lower || '1-7'}` : '<em>None assigned</em>')}
                        </div>
                    </div>
                    <div class="legend-row">
                        <div class="legend-label">🔘 Buttons / Cutouts:</div>
                        <div class="legend-content">
                            ${btnList.length > 0 ? btnList.join(', ') : '<em>None assigned</em>'}
                        </div>
                    </div>
                    ${rampList.length > 0 ? `
                        <div class="legend-row">
                            <div class="legend-label">📐 Bite Ramps:</div>
                            <div class="legend-content">Teeth: ${rampList.join(', ')} (Anterior Lingual Bite Opening)</div>
                        </div>
                    ` : ''}
                    <div class="legend-row">
                        <div class="legend-label">📏 IPR Reduction:</div>
                        <div class="legend-content">
                            ${(upperIprList.length > 0 || lowerIprList.length > 0) ? `
                                ${upperIprList.length > 0 ? `<strong>Upper:</strong> ${upperIprList.join(', ')} ` : ''}
                                ${lowerIprList.length > 0 ? `• <strong>Lower:</strong> ${lowerIprList.join(', ')}` : ''}
                            ` : '<em>No IPR assigned for this protocol</em>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    return {
        UPPER_TEETH,
        LOWER_TEETH,
        getToothType,
        getPalmerNumber,
        normalizeFeature,
        createToothSVG,
        renderArch,
        renderOverviewDualArchHTML
    };
})();

window.ToothChart = ToothChart;
