/**
 * Rainbow Explainer — Interactive Educational Site
 * Handles scroll-triggered animations, interactive canvas,
 * navigation, progress bar, and keyboard controls.
 */

document.addEventListener('DOMContentLoaded', () => {

    // =========================================================
    // 1. SVG Path Length Initialization
    //    Must run before observer so paths start hidden.
    // =========================================================

    // Only apply dash hiding to hero-arc beams (which have draw-in animations).
    // Other section beams should be visible immediately — no dash tricks.
    document.querySelectorAll('#hero-arc .beam').forEach(el => {
        if (typeof el.getTotalLength === 'function') {
            try {
                const length = el.getTotalLength();
                el.style.strokeDasharray = length;
                el.style.strokeDashoffset = length;
            } catch (e) {
                // Not a geometry element — skip dash setup
            }
        }
    });

    // =========================================================
    // 2. Intersection Observer — Scroll-Triggered Animations
    // =========================================================

    const sections = document.querySelectorAll('.section');

    const counter = document.getElementById('section-counter');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');

                // Update dot navigation
                document.querySelectorAll('.dot-link').forEach(dot => {
                    dot.classList.remove('active');
                });
                const activeDot = document.querySelector(
                    `.dot-link[data-section="${entry.target.id}"]`
                );
                if (activeDot) activeDot.classList.add('active');

                // Keep keyboard nav index in sync
                const idx = Array.from(sections).indexOf(entry.target);
                if (idx !== -1) currentSectionIndex = idx;

                // Update section counter
                if (counter) {
                    counter.textContent = `${idx + 1} / ${sections.length}`;
                }
            }
        });
    }, { threshold: 0.3 });

    sections.forEach(section => observer.observe(section));

    // =========================================================
    // 3. Progress Bar
    // =========================================================

    const progressBar = document.getElementById('progress-bar');

    window.addEventListener('scroll', () => {
        if (!progressBar) return;
        const scrollTop = document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollHeight > 0) {
            const progress = (scrollTop / scrollHeight) * 100;
            progressBar.style.width = progress + '%';
        }
    });

    // =========================================================
    // 4. Dot Navigation — Smooth Scroll
    // =========================================================

    document.querySelectorAll('.dot-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // =========================================================
    // 5. Interactive Canvas — The 42-Degree Angle
    //    (init moved below variable declarations)
    // =========================================================

    const canvas = document.getElementById('angle-canvas');


    // =========================================================
    // 6. Keyboard Navigation
    // =========================================================

    let currentSectionIndex = 0;

    document.addEventListener('keydown', (e) => {
        // When the canvas is focused, arrow keys move the sun
        if (canvas && document.activeElement === canvas) {
            if (e.key === 'ArrowUp') {
                sunY = Math.max(30, sunY - 10);
                drawCanvas();
                e.preventDefault();
            }
            if (e.key === 'ArrowDown') {
                sunY = Math.min(250, sunY + 10);
                drawCanvas();
                e.preventDefault();
            }
            return;
        }

        // Otherwise, arrow keys navigate between sections
        if (e.key === 'ArrowDown' || e.key === ' ') {
            e.preventDefault();
            currentSectionIndex = Math.min(currentSectionIndex + 1, sections.length - 1);
            sections[currentSectionIndex].scrollIntoView({ behavior: 'smooth' });
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentSectionIndex = Math.max(currentSectionIndex - 1, 0);
            sections[currentSectionIndex].scrollIntoView({ behavior: 'smooth' });
        }
    });

    // =========================================================
    // 7. Mark Hero Visible on Load
    // =========================================================

    const hero = document.getElementById('hero');
    if (hero) hero.classList.add('visible');

    // Auto-hide scroll indicator on scroll
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        let scrollHidden = false;
        window.addEventListener('scroll', () => {
            if (!scrollHidden && window.scrollY > 50) {
                scrollIndicator.style.opacity = '0';
                scrollIndicator.style.transition = 'opacity 0.5s';
                scrollHidden = true;
            }
        });
    }

    // Smooth scroll for back-to-top link
    const backToTop = document.querySelector('.back-to-top');
    if (backToTop) {
        backToTop.addEventListener('click', (e) => {
            e.preventDefault();
            const heroEl = document.getElementById('hero');
            if (heroEl) heroEl.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Hero is visible immediately


    // =============================================================
    // Canvas State (must be before initCanvas call)
    // =============================================================

    var ctx;
    var sunY = 80;           // Draggable sun Y position (range 30–250)
    var dragging = false;
    var animFrameId = null;

    // Logical canvas dimensions (CSS pixels)
    const CW = 600;
    const CH = 500;

    // Observer position
    const OBS_X = 300;
    const OBS_Y = 450;

    // Ground line
    const GROUND_Y = 430;

    // Rainbow palette (red outermost to violet innermost)
    const RAINBOW = [
        '#ff1744', '#ff6d00', '#ffd600',
        '#00e676', '#2979ff', '#3d5afe', '#d500f9'
    ];

    // NOW init canvas (after all const declarations)
    if (canvas) {
        initCanvas(canvas);
    }

    function initCanvas(canvasEl) {
        ctx = canvasEl.getContext('2d');

        // Retina / HiDPI scaling
        const dpr = window.devicePixelRatio || 1;
        canvasEl.width = CW * dpr;
        canvasEl.height = CH * dpr;
        canvasEl.style.width = CW + 'px';
        canvasEl.style.height = CH + 'px';
        ctx.scale(dpr, dpr);

        // Make canvas focusable and accessible for keyboard interaction
        canvasEl.setAttribute('tabindex', '0');
        canvasEl.setAttribute('role', 'application');

        // --- Mouse events ---
        canvasEl.addEventListener('mousedown', onPointerDown);
        canvasEl.addEventListener('mousemove', onPointerMove);
        canvasEl.addEventListener('mouseup', onPointerUp);
        canvasEl.addEventListener('mouseleave', onPointerUp);

        // --- Touch events ---
        canvasEl.addEventListener('touchstart', onTouchStart, { passive: false });
        canvasEl.addEventListener('touchmove', onTouchMove, { passive: false });
        canvasEl.addEventListener('touchend', onPointerUp);
        canvasEl.addEventListener('touchcancel', onPointerUp);

        // Responsive sizing
        fitCanvas(canvasEl);
        window.addEventListener('resize', () => fitCanvas(canvasEl));

        // Initial draw
        drawCanvas();
    }

    /** Scale canvas container if viewport is narrower than 600px */
    function fitCanvas(canvasEl) {
        const parent = canvasEl.parentElement;
        if (!parent) return;
        const maxWidth = parent.clientWidth;
        if (maxWidth < CW) {
            const scale = maxWidth / CW;
            canvasEl.style.width = maxWidth + 'px';
            canvasEl.style.height = (CH * scale) + 'px';
        } else {
            canvasEl.style.width = CW + 'px';
            canvasEl.style.height = CH + 'px';
        }
    }

    // ----------------------------------------------------------
    // Pointer helpers
    // ----------------------------------------------------------

    function getCanvasCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = CW / rect.width;
        const scaleY = CH / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    function isNearSun(px, py) {
        const dx = px - OBS_X;   // sun X is always center
        const dy = py - sunY;
        return Math.sqrt(dx * dx + dy * dy) < 30;
    }

    function hidePrompt() {
        const prompt = document.querySelector('.canvas-prompt');
        if (prompt) prompt.classList.add('hidden');
    }

    function onPointerDown(e) {
        const { x, y } = getCanvasCoords(e);
        if (isNearSun(x, y)) {
            dragging = true;
            hidePrompt();
        }
    }

    function onPointerMove(e) {
        if (!dragging) return;
        const { y } = getCanvasCoords(e);
        sunY = Math.max(30, Math.min(250, y));
        requestDraw();
    }

    function onPointerUp() {
        dragging = false;
    }

    function onTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const scaleX = CW / rect.width;
        const scaleY = CH / rect.height;
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;
        if (isNearSun(x, y)) {
            dragging = true;
            hidePrompt();
        }
    }

    function onTouchMove(e) {
        if (!dragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const scaleY = CH / rect.height;
        const y = (touch.clientY - rect.top) * scaleY;
        sunY = Math.max(30, Math.min(250, y));
        requestDraw();
    }

    /** Throttle redraws to animation frames */
    function requestDraw() {
        if (animFrameId) return;
        animFrameId = requestAnimationFrame(() => {
            drawCanvas();
            animFrameId = null;
        });
    }

    // ----------------------------------------------------------
    // Drawing
    // ----------------------------------------------------------

    function drawCanvas() {
        if (!ctx) return;

        // --- Background gradient (darker at top, lighter near ground) ---
        const bgGrad = ctx.createLinearGradient(0, 0, 0, CH);
        bgGrad.addColorStop(0, '#060610');
        bgGrad.addColorStop(0.5, '#0a0a1a');
        bgGrad.addColorStop(0.85, '#121830');
        bgGrad.addColorStop(1, '#1a2040');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, CW, CH);

        // --- Ground line ---
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y);
        ctx.lineTo(CW, GROUND_Y);
        ctx.stroke();

        // --- Ground texture (subtle dots for depth) ---
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        const groundDots = [
            [45, GROUND_Y + 3, 1.2], [120, GROUND_Y + 5, 0.8], [180, GROUND_Y + 2, 1.0],
            [260, GROUND_Y + 6, 0.7], [330, GROUND_Y + 4, 1.1], [400, GROUND_Y + 3, 0.9],
            [470, GROUND_Y + 7, 0.6], [520, GROUND_Y + 2, 1.0], [570, GROUND_Y + 5, 0.8],
            [80, GROUND_Y + 8, 0.5], [210, GROUND_Y + 9, 0.6], [350, GROUND_Y + 8, 0.7],
            [490, GROUND_Y + 10, 0.5], [150, GROUND_Y + 12, 0.4], [440, GROUND_Y + 11, 0.5]
        ];
        groundDots.forEach(([gx, gy, gr]) => {
            ctx.beginPath();
            ctx.arc(gx, gy, gr, 0, Math.PI * 2);
            ctx.fill();
        });
        // Short ground marks (tiny dashes)
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.8;
        const groundMarks = [
            [60, GROUND_Y + 1, 60 + 6, GROUND_Y + 2],
            [200, GROUND_Y + 1, 200 + 5, GROUND_Y + 3],
            [310, GROUND_Y + 2, 310 + 7, GROUND_Y + 2],
            [450, GROUND_Y + 1, 450 + 5, GROUND_Y + 3],
            [540, GROUND_Y + 2, 540 + 4, GROUND_Y + 1]
        ];
        groundMarks.forEach(([x1, y1, x2, y2]) => {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        });

        // --- Anti-solar line ---
        // Extends from sun through observer and below
        const dx = OBS_X - OBS_X;  // 0 (sun is directly above)
        const dy = OBS_Y - sunY;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const dirX = dx / len;
        const dirY = dy / len;

        // Extend well past observer
        const extLen = 600;
        const antiX = OBS_X + dirX * extLen;
        const antiY = OBS_Y + dirY * extLen;

        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(OBS_X, sunY);
        ctx.lineTo(antiX, antiY);
        ctx.stroke();
        ctx.restore();

        // --- Compute rainbow geometry ---
        // Sun elevation angle (from ground, in radians)
        const sunElevation = Math.atan2(GROUND_Y - sunY, 1); // simplified vertical
        const sunElevDeg = (sunElevation * 180) / Math.PI;

        // Anti-solar point is below the horizon by the sun elevation angle
        // Rainbow appears 42 degrees from the anti-solar direction
        // Arc center = anti-solar point (projected below observer)
        const antiSolarY = OBS_Y + (OBS_Y - sunY);
        const arcCenterX = OBS_X;
        const arcCenterY = antiSolarY;

        // Rainbow radius in canvas pixels (scales with geometry)
        const distToAntiSolar = antiSolarY - OBS_Y;
        const rainbowRadius = distToAntiSolar * Math.tan(42 * Math.PI / 180);
        // Clamp radius to sensible range
        const clampedRadius = Math.max(60, Math.min(400, rainbowRadius));

        // Determine if rainbow is visible (sun must be below ~42 deg elevation)
        const sunTooHigh = sunY < 100;

        if (!sunTooHigh && clampedRadius > 0) {
            // Calculate the visible arc angles (portion above ground)
            // The arc is centered below the observer; we only show the part above ground
            const groundOffset = GROUND_Y - arcCenterY;
            let startAngle, endAngle;

            if (arcCenterY >= GROUND_Y) {
                // Anti-solar point is at or below ground: full semicircle visible
                startAngle = Math.PI;
                endAngle = 2 * Math.PI;
            } else {
                // Clip arc to above ground
                const cosClip = groundOffset / clampedRadius;
                if (cosClip >= 1) {
                    // Entire arc below ground
                    startAngle = 0;
                    endAngle = 0;
                } else if (cosClip <= -1) {
                    startAngle = Math.PI;
                    endAngle = 2 * Math.PI;
                } else {
                    const clipAngle = Math.acos(-cosClip);
                    startAngle = Math.PI / 2 + clipAngle;
                    endAngle = Math.PI / 2 + (2 * Math.PI - clipAngle);
                    // Ensure we draw the upper portion
                    startAngle = Math.PI + Math.asin(Math.min(1, Math.abs(groundOffset / clampedRadius)));
                    endAngle = 2 * Math.PI - Math.asin(Math.min(1, Math.abs(groundOffset / clampedRadius)));
                    if (groundOffset > 0) {
                        startAngle = Math.PI;
                        endAngle = 2 * Math.PI;
                    }
                }
            }

            // Draw rainbow arcs (outermost red to innermost violet)
            const bandWidth = 4;
            const totalBands = RAINBOW.length;

            for (let i = 0; i < totalBands; i++) {
                const r = clampedRadius + (totalBands / 2 - i) * bandWidth;

                // Pass 1: soft glow layer
                ctx.save();
                ctx.shadowColor = RAINBOW[i];
                ctx.shadowBlur = 20;
                ctx.strokeStyle = RAINBOW[i];
                ctx.lineWidth = bandWidth + 2;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.arc(arcCenterX, arcCenterY, r, startAngle, endAngle, false);
                ctx.stroke();
                ctx.restore();

                // Pass 2: sharp core layer
                ctx.save();
                ctx.shadowColor = RAINBOW[i];
                ctx.shadowBlur = 6;
                ctx.strokeStyle = RAINBOW[i];
                ctx.lineWidth = bandWidth;
                ctx.globalAlpha = 0.95;
                ctx.beginPath();
                ctx.arc(arcCenterX, arcCenterY, r, startAngle, endAngle, false);
                ctx.stroke();
                ctx.restore();
            }

            // --- Light rays from rainbow arc to observer ---
            const rayCount = 5;
            for (let i = 0; i < rayCount; i++) {
                const t = startAngle + (endAngle - startAngle) * ((i + 0.5) / rayCount);
                const rx = arcCenterX + clampedRadius * Math.cos(t);
                const ry = arcCenterY + clampedRadius * Math.sin(t);
                const colorIdx = Math.floor((i / rayCount) * RAINBOW.length);
                ctx.save();
                ctx.strokeStyle = RAINBOW[colorIdx];
                ctx.globalAlpha = 0.2;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(rx, ry);
                ctx.lineTo(OBS_X, OBS_Y - 28); // observer's head
                ctx.stroke();
                ctx.restore();
            }

            // --- 42-degree angle annotation ---
            // Draw a line from observer to the top of the rainbow arc
            const topArcX = arcCenterX;
            const topArcY = arcCenterY - clampedRadius;

            if (topArcY < GROUND_Y) {
                ctx.save();
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(OBS_X, OBS_Y - 28);
                ctx.lineTo(topArcX, topArcY);
                ctx.stroke();
                ctx.restore();

                // Label
                const labelX = OBS_X + 15;
                const labelY = (OBS_Y - 28 + topArcY) / 2;
                ctx.save();
                ctx.font = 'bold 16px "Courier New", monospace';
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'left';
                ctx.shadowColor = 'rgba(255,255,255,0.6)';
                ctx.shadowBlur = 8;
                ctx.fillText('42\u00B0', labelX, labelY);
                ctx.restore();
            }
        }

        // "Sun too high" message
        if (sunTooHigh) {
            ctx.save();
            ctx.font = '14px "Courier New", monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.textAlign = 'center';
            ctx.fillText('Sun too high \u2014 no rainbow visible', CW / 2, CH / 2);
            ctx.restore();
        }

        // --- Observer (stick figure) ---
        drawObserver();

        // --- Sun ---
        drawSun(OBS_X, sunY);
    }

    function drawObserver() {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;

        // Head (larger, filled for visibility)
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(OBS_X, OBS_Y - 28, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.moveTo(OBS_X, OBS_Y - 18);
        ctx.lineTo(OBS_X, OBS_Y + 7);
        ctx.stroke();

        // Legs
        ctx.beginPath();
        ctx.moveTo(OBS_X, OBS_Y + 7);
        ctx.lineTo(OBS_X - 12, OBS_Y + 24);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(OBS_X, OBS_Y + 7);
        ctx.lineTo(OBS_X + 12, OBS_Y + 24);
        ctx.stroke();

        // Arms
        ctx.beginPath();
        ctx.moveTo(OBS_X, OBS_Y - 10);
        ctx.lineTo(OBS_X - 14, OBS_Y + 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(OBS_X, OBS_Y - 10);
        ctx.lineTo(OBS_X + 14, OBS_Y + 2);
        ctx.stroke();

        ctx.restore();
    }

    function drawSun(x, y) {
        ctx.save();

        // Glow
        const glowGrad = ctx.createRadialGradient(x, y, 5, x, y, 50);
        glowGrad.addColorStop(0, 'rgba(255,214,0,0.6)');
        glowGrad.addColorStop(0.5, 'rgba(255,214,0,0.15)');
        glowGrad.addColorStop(1, 'rgba(255,214,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, 50, 0, Math.PI * 2);
        ctx.fill();

        // Sun disc
        const discGrad = ctx.createRadialGradient(x, y, 0, x, y, 20);
        discGrad.addColorStop(0, '#fff9c4');
        discGrad.addColorStop(0.6, '#ffd600');
        discGrad.addColorStop(1, '#ffab00');
        ctx.fillStyle = discGrad;
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fill();

        // Sun rays (8 lines radiating outward)
        ctx.strokeStyle = '#ffe040';
        ctx.lineWidth = 2.5;
        const rayLen = 16;
        const rayGap = 8;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const innerR = 20 + rayGap;
            const outerR = 20 + rayGap + rayLen;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(angle) * innerR, y + Math.sin(angle) * innerR);
            ctx.lineTo(x + Math.cos(angle) * outerR, y + Math.sin(angle) * outerR);
            ctx.stroke();
        }

        // Drag hint label
        ctx.font = '11px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.textAlign = 'center';
        ctx.fillText('drag me', x, y + 55);

        ctx.restore();
    }
});
