```markdown
# Design System Document: Industrial Precision & Operational Authority

## 1. Overview & Creative North Star: "Kinetic Brutalism"
The Creative North Star for this design system is **Kinetic Brutalism**. Unlike standard enterprise dashboards that lean on soft roundness and friendly whitespace, this system embraces the raw, uncompromising nature of industrial machinery. It is a high-precision instrument, not a website.

We move beyond the "template" look by utilizing **Intentional Asymmetry**. Heavy data blocks are balanced against expansive, stark headers. We use **0px border-radii** to communicate structural rigidity. The experience must feel like a hardened terminal—authoritative, high-density, and mission-critical.

---

## 2. Colors & Surface Philosophy
The palette is rooted in low-light environments where high-contrast accents serve as functional signals, not just decoration.

### The "No-Line" Rule
**Explicit Instruction:** Traditional 1px solid borders for sectioning are prohibited. Boundaries are defined strictly through background shifts.
- To separate a sidebar from a main stage, place a `surface-container-low` (#1C1B1B) panel against the `background` (#131313).
- To define a data cell, use a tonal shift to `surface-container-high` (#2A2A2A).

### Surface Hierarchy & Nesting
Treat the UI as a physical console with recessed and raised plates.
- **Base Level:** `surface-container-lowest` (#0E0E0E) for deep background utility areas.
- **Primary Stage:** `surface` (#131313) for the main operational environment.
- **Information Blocks:** `surface-container` (#201F1F) for modular units.
- **Active Overlays:** `surface-bright` (#393939) for transient panels.

### Signature Textures & Glass
- **The "Glassmorphism" Exception:** For "Locked" or "Degraded" states, use a backdrop-blur (12px+) with a 40% opacity `surface-container-lowest`. This creates a "heavy smoked glass" effect that obscures data without losing the sense of the underlying environment.
- **Safety Gradients:** Primary CTAs should utilize a subtle linear gradient from `primary` (#FFB690) to `primary_container` (#F97316) at a 135-degree angle to simulate the sheen of industrial plastic.

---

### 3. Typography: The Bilingual Hierarchy
The system balances the technical aesthetic of **Space Grotesk** with the utilitarian readability of **Public Sans**.

- **Display & Headlines (Space Grotesk):** Reserved for telemetry, high-level status, and section titles. The wide apertures and geometric forms command attention.
- **Body & Data (Public Sans):** Used for all operational data, bilingual TH/EN labels, and logs. Public Sans is chosen for its exceptional legibility in dense tables.
- **Bilingual Rule:** When TH and EN are displayed together, the TH text should be scaled to 110% of the EN font size to ensure optical weight parity, as Thai glyphs are inherently more complex.

---

## 4. Elevation & Depth: Tonal Layering
We reject "Material" shadows. Depth is achieved through light and shadow logic inherent to industrial materials.

- **The Layering Principle:** Stacking is chronological. The most recent action or "top" layer must always be the brightest (`surface-container-highest`).
- **Ambient Shadows:** For floating modals (only used for Critical Risk alerts), use an extra-diffused shadow: `box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6)`. The shadow color should be a tinted dark-steel, never pure black.
- **The "Ghost Border" Fallback:** In high-density tables where tonal shifts are insufficient, use a 1px line of `outline_variant` (#584237) at **15% opacity**. It should feel like a faint etch on metal, not a drawn line.

---

## 5. Components & Operational Patterns

### Buttons: Risk-Tiered Execution
- **Safe/Primary:** `primary_container` (#F97316). Solid fill. For standard operational flow.
- **Safe/Neutral:** `secondary_container` (#434B18) with `on_secondary_container` text. For "Success" states and confirmed system checks.
- **Risky/Action:** `tertiary_container` (#FF6A60). Ghost style with a `tertiary` outline. Requires a 2-second "Hold to Confirm" interaction.
- **Critical/Destructive:** `error_container` (#93000A). High-contrast pulsing state when hovered.

### The Double-Lock Pattern (High-Risk Actions)
For actions like "Purge System" or "Override Lockout":
1. **Initial Trigger:** A `tertiary` button.
2. **Engagement State:** The button transforms into a progress bar (Hold-to-Activate).
3. **Verification State:** A secondary confirmation input appears in `surface-bright`.

### Dense Data Tables
- **No Dividers:** Rows are separated by 4px of vertical whitespace. 
- **Alternate Striping:** Use `surface-container-low` and `surface-container-lowest` for row alternation.
- **Status Indicators:** Use 4px wide vertical "Status Spikes" on the far left of a row (Muted Military Olive for nominal, Oxidized Red for critical).

### UI States
- **Degraded:** The background shifts to a `surface_dim` tint. Space Grotesk headers lose 20% opacity.
- **Locked:** An opaque `surface-container-lowest` overlay with a "Security-Pattern" SVG mesh texture.
- **Loading:** A monochrome "Scanning" bar utilizing the `primary` color at 10% opacity, moving across the top of the affected container.

---

## 6. Do’s and Don’ts

### Do:
- Use **Monospaced Numbering** within Public Sans for all telemetry to prevent "jitter" during data updates.
- Leverage **Intentional Asymmetry**—align headers to the far left and secondary controls to the far right with vast negative space between them.
- Ensure all TH (Thai) characters have sufficient line-height (1.6 or higher) to prevent "clipping" of tone marks in dense tables.

### Don’t:
- **No Rounded Corners:** Any radius above 0px violates the "Industrial Grade" principle.
- **No High-Contrast Borders:** Never use `on_surface` for lines; it creates visual noise that competes with critical data.
- **No Soft Transitions:** Use 100ms or "Instant" transitions for state changes to mimic the tactile response of physical switches. Avoid "bouncy" or "playful" easing.

---
**Note to Designers:** This system is built for operators working in high-stress environments. Every pixel must serve a functional purpose. If an element doesn't provide information or enable an action, remove it.```