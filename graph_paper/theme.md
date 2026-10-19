# Repository-wide interface design rule

For user-facing apps and sites in this repository, use the visual system below as the default. Apply it to new projects and when redesigning existing ones. Preserve an established project's necessary identity and behavior, and follow a more specific project instruction or the user's direction when it differs.

## Visual style

- Keep the interface calm, light, compact, and easy to scan. Use open space, clear hierarchy, and a small number of colors. Avoid decorative effects that compete with the work area.
- Use a warm, pale green-gray page background (`#f6f8f4`) with white panels. Keep the canvas quiet and natural; avoid strong gradients.
- Use botanical green as the primary accent: `#236e48`; use deep green (`#164e35`) for hover or pressed states and pale green (`#e9f3eb`) for soft accent surfaces. Use muted leaf greens such as `#427953`, `#84a96f`, and `#b1c882` sparingly for small decorative details. Use sage (`#8fb889`) for visible focus rings. Reserve muted rust (`#a4543e` on `#fbefeb`) for errors.
- Use these base tokens where they fit:

  ```css
  :root {
    --paper: #f6f8f4;
    --white: #fff;
    --ink: #20352b;
    --muted: #718078;
    --line: #e3e9e2;
    --green: #236e48;
    --green-dark: #164e35;
    --green-soft: #e9f3eb;
    --danger: #a4543e;
    --danger-soft: #fbefeb;
  }
  ```

- Prefer DM Sans for body text and Manrope for headings and the brand mark, with Segoe UI and sans-serif fallbacks. Keep body copy readable and controls compact; use small uppercase, letter-spaced eyebrow labels sparingly.
- Use moderate corner radii: about 12px for panels, 7–9px for controls, and 6–8px for cards. Use thin green-gray borders and subtle shadows only to separate layers.
- Make the main work area the visual focus. Use green for primary actions and state cues; use pale green surfaces or a narrow green edge to distinguish cards. Keep secondary actions white or neutral.
- Keep motion brief and restrained. Respect `prefers-reduced-motion`.

## Layout and interaction

- Use a compact header with a small rounded green brand detail, a clear title, and any secondary actions grouped cleanly. Keep the main content wide enough for its task while avoiding unnecessary nested scrolling.
- Make layouts responsive. Allow header content and controls to wrap on narrow screens; keep grids and text legible without clipping or horizontal overflow where practical.
- Provide visible keyboard focus, semantic HTML, associated labels, useful accessible names, and adequate contrast. Give hover and disabled states clear but quiet styling.
- Keep forms, toolbars, cards, and tables visually consistent with the same tokens and spacing. Use separators and alignment before adding more colors or decoration.

## Attribution

Include this compact creator line in the header of user-facing apps and sites unless the user asks to omit it or the format has no suitable header:

```html
By Paul Gavini · <a href="https://www.youtube.com/@paulgavini">YouTube</a> · <a href="https://paulgavini.github.io/">Website</a>
```

Use `By Paul Gavini` with this capitalization. Keep the links labeled `YouTube` and `Website`, style them with the green accent, and let the line wrap on small screens. If a project needs to link directly to its own live page instead of the homepage, use that project's relevant URL for the Website link. For links opened in a new tab, add `target="_blank"` and `rel="noopener noreferrer"`.
