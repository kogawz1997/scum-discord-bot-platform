```markdown
# Design System Documentation: The Command Interface

## 1. Overview & Creative North Star

### Creative North Star: "The Hardened Console"
This design system is not a consumer app; it is a high-stakes operational tool. It rejects the "softness" of modern SaaS in favor of **Functional Brutalism**. We are building a digital manifestation of a heavy-duty, military-grade control center. The goal is "Production-Ready Discipline"—every pixel must feel like it was machined from steel and calibrated for high-density data oversight.

### Beyond the Template
To move beyond a generic "dark mode" look, this system utilizes **Intentional Asymmetry** and **Structural Mass**. We break the standard grid by using heavy, varying stroke weights and staggered container heights. Elements don't "float"; they are bolted into the interface. We support complex i18n (Thai/English) by ensuring vertical leading is generous even when horizontal density is high, maintaining legibility in condensed industrial environments.

---

## 2. Colors & Surface Logic

The palette is driven by the utility of a bunker. We use the **Surface-Container Scale** to define depth, moving away from shadows and toward "Tonal Carving."

### The Palette
- **Base (Surface):** `#131313` (Deep Charcoal) – The void of the monitor.
- **Structural (Surface Container):** `#201f1f` to `#353534` – The weathered steel housing.
- **Primary (Action):** `#F97316` (Safety Orange) – High-visibility alerts and primary commands.
- **Secondary (Status):** `#4D7C0F` (Muted Olive) – Operational "Go" states.
- **Tertiary/Error (Critical):** `#B91C1C` (Oxidized Red) – System failures.

### The "Thick-Stroke" Rule
Contrary to standard minimalist systems, we **prohibit 1px borders**. To define a section, you must use either:
1.  **Background Shift:** A `surface-container-low` section against a `surface` background.
2.  **The Structural Border:** A `2px` to `4px` solid border using `outline` or `outline-variant` to signify heavy-duty containment.

### Surface Hierarchy & Nesting
Treat the UI as a physical console. 
- **The Chassis:** The main background uses `surface`.
- **The Modules:** Inner panels use `surface-container-high`.
- **The Input Wells:** Fields and interactive zones use `surface-container-lowest` to create a "recessed" or carved-out look.

---

## 3. Typography

The typographic system is a juxtaposition of high-impact propaganda and cold, technical precision.

- **Headers (Space Grotesk):** All-caps, tracked out (+5% to +10%). This is your "Voice of Authority." Used for `display` and `headline` tiers to command attention.
- **Data (Public Sans):** Chosen for its monospaced-adjacent qualities. In high-density tables, it ensures numbers align vertically, mimicking a physical readout.

### Typography Scale
- **Display-LG (Space Grotesk, 3.5rem):** Critical system status / Sector designations.
- **Headline-SM (Space Grotesk, 1.5rem):** Module titles. Always All-Caps.
- **Title-MD (Public Sans, 1.125rem):** Section labels.
- **Body-MD (Public Sans, 0.875rem):** The workhorse for technical descriptions and Thai character support.

---

## 4. Elevation & Depth

In a military-industrial context, "floating" is a weakness. We do not use light-source shadows. We use **Material Layering.**

### The Layering Principle
Depth is achieved by stacking. A `surface-container-highest` element sits "atop" a `surface-container-low` area. The contrast between these two grey values is the only indicator of elevation needed.

### The "Ghost Border" Fallback
If a secondary container requires definition without adding "mass," use a **Ghost Border**: `outline-variant` at 20% opacity. This provides a faint technical grid feel without breaking the brutalist aesthetic.

### Glassmorphism (Tactical Implementation)
Use `surface` colors at 80% opacity with a heavy `backdrop-blur` (20px+) ONLY for temporary overlays like "Sector Map" modals. This mimics a glass HUD over a mechanical console.

---

## 5. Components

### Buttons (Tactical Actuators)
- **Primary:** `primary_container` (#F97316) background, `on_primary_container` text. **2px solid border** of the same color. Square corners (0px radius).
- **Secondary:** Transparent background, `outline` color 2px border. All-caps text.
- **States:** On hover, the border weight increases from 2px to 4px. No color change. This mimics the "mechanical resistance" of a physical switch.

### Input Fields (Data Entry)
- **Visuals:** Use `surface_container_lowest` for the field background. A bottom-only 2px border using `outline`.
- **Labels:** Always `label-sm` (Public Sans) positioned above the field, never floating inside.
- **Error:** Switch border to `oxidized_red` (#B91C1C) and add a "CRITICAL" label prefix.

### Cards & Modules
- **Rule:** Forbid divider lines within cards. Use `surface_container` shifts to separate the header from the body.
- **Density:** High. Content padding should be a strict 16px. Content is "bolted" to the edges.

### Status Indicators (The "Bunker" HUD)
- **Operational:** Muted Olive (#4D7C0F) solid squares.
- **Alert:** Safety Orange (#F97316) pulsing borders.
- **Critical:** Oxidized Red (#B91C1C) heavy 4px container borders.

---

## 6. Do’s and Don’ts

### Do:
- **Do** use 0px border radius for everything. Roundness is for civilian software.
- **Do** use `Public Sans` for any string containing numbers or coordinates to maintain the "Technical Readout" feel.
- **Do** use high-contrast text (on-surface) against dark backgrounds to ensure Thai glyphs remain legible at small sizes.

### Don’t:
- **Don’t** use shadows to show importance. Use border weight (2px vs 4px) instead.
- **Don’t** use gradients unless they are subtle "metal grain" textures in the background.
- **Don’t** use "arcade" or "cyberpunk" neons. Every color must have a functional, industrial purpose (Safety, Error, Status).
- **Don’t** allow 1px lines. If it’s worth drawing, it’s worth making it 2px. Size is strength.