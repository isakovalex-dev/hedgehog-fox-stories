# Concept-Faithful First Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose the existing homepage assets so the desktop first screen closely matches the approved “Живая книга путешествий” concept without generating a new image or changing application functionality.

**Architecture:** Keep the existing responsive `<picture>` and application DOM contracts. On the homepage only, turn the hero artwork into a full-area absolute watercolor layer, place the copy over the source image’s quiet left side, remove the radial mask, and pull the three story cards over the bottom of the hero. Restore an ordinary in-flow image composition below the mobile breakpoint.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript DOM contracts, Node.js 22 test runner, AVIF/WebP responsive images.

## Global Constraints

- Do not generate a new AI image.
- Preserve the aspect ratio of every hero source; never stretch the artwork.
- Preserve all current stories, authentication, story creation, library, pricing, parents section, about page, journey progress, no-JS archive, and both production games.
- Show `История от автора` for built-in stories and `Моя история` for user stories.
- Keep homepage styles isolated behind `.home-page`.
- Keep the existing AVIF/WebP variants and do not eagerly load `assets/hero-friends.png`.
- Keep interactive targets at least 44 px.
- Do not stage or modify user-owned untracked files.

---

## File Structure

- Modify `tests/ui-contract.test.js`: replace the obsolete oval-mask and two-column geometry contracts with full-bleed hero, overlap, responsive-image, and mobile restoration contracts.
- Modify `index.html`: update only the hero `<source sizes>` hints so the browser selects images for a full-width scene.
- Modify `styles/homepage-book.css`: implement the full-area watercolor layer, copy overlay, card overlap, compact first-fold spacing, and mobile in-flow fallback.

### Task 1: Recompose the complete first screen

**Files:**
- Modify: `tests/ui-contract.test.js`
- Modify: `index.html`
- Modify: `styles/homepage-book.css`
- Test: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: existing `.journey-hero`, `.journey-hero__copy`, `.journey-hero__art`, `.book-hero-picture`, `.stories-section`, `.story-list`, `.book-route--hero`, and `.home-page` route isolation.
- Produces: a full-width desktop hero artwork layer; an overlaid left copy block; three overlapping story cards; responsive `sizes="(max-width: 1500px) 100vw, 1500px"`; a non-absolute mobile illustration.

- [ ] **Step 1: Replace obsolete geometry tests with failing full-bleed contracts**

In `tests/ui-contract.test.js`, update the hero source expectation:

```js
test("homepage hero sources size AVIF and WebP for the full-width scene", () => {
  const html = read("index.html");
  const expectedSizes = "(max-width: 1500px) 100vw, 1500px";
  const sourceTags = [...html.matchAll(/<source\b[\s\S]*?\/>/g)].map((match) => match[0]);

  ["avif", "webp"].forEach((format) => {
    const source = sourceTags.find(
      (tag) => tag.includes(`type="image/${format}"`) && tag.includes(`hero-coast-480.${format}`)
    );
    assert.ok(source, `Missing ${format.toUpperCase()} hero source`);
    assert.match(source, new RegExp(`sizes=["']${expectedSizes.replace(/[().]/g, "\\$&")}["']`));
    ["480", "768", "1200", "1800"].forEach((width) => {
      assert.match(source, new RegExp(`hero-coast-${width}\\.${format}\\s+${width}w`));
    });
  });
});
```

Replace the oval-mask test with:

```js
test("faithful homepage hero uses one full-bleed watercolor layer without an oval mask", () => {
  const css = read("styles/homepage-book.css");

  assert.match(
    css,
    /\.home-page \.journey-hero__art\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;/
  );
  assert.match(
    css,
    /\.home-page \.book-hero-picture img\s*\{[\s\S]*?height:\s*100%;[\s\S]*?object-fit:\s*cover;[\s\S]*?object-position:\s*center 46%;/
  );
  assert.doesNotMatch(css, /mask-image:\s*radial-gradient/);
});
```

Replace the desktop concept geometry assertions with:

```js
test("desktop homepage overlaps three story cards with the watercolor first screen", () => {
  const css = read("styles/homepage-book.css");
  const desktopStart = css.indexOf("@media (min-width: 1101px)");
  const desktopEnd = css.indexOf("@media", desktopStart + 1);
  const desktop = css.slice(desktopStart, desktopEnd);

  assert.ok(desktopStart >= 0, "Missing desktop-only concept composition");
  assert.match(
    desktop,
    /\.home-page \.journey-hero\s*\{[\s\S]*?min-height:\s*500px;[\s\S]*?padding:\s*clamp\(2rem,\s*5vw,\s*4\.5rem\)\s+clamp\(1\.5rem,\s*5vw,\s*4\.5rem\)\s+5rem;/
  );
  assert.match(
    desktop,
    /\.home-page \.stories-section\s*\{[\s\S]*?z-index:\s*4;[\s\S]*?margin-top:\s*-80px;/
  );
  assert.match(
    desktop,
    /\.home-page \.stories-section \.section-heading,[\s\S]*?\.home-page \.stories-section \.filters\s*\{[\s\S]*?display:\s*none;/
  );
  assert.match(
    desktop,
    /\.home-page \.stories-section \.story-list\s*\{[\s\S]*?grid-auto-columns:\s*calc\(\(100% - 2\.2rem\) \/ 3\);[\s\S]*?grid-auto-flow:\s*column;/
  );
  assert.match(
    desktop,
    /\.home-page \.stories-section \.story-card\s*\{[\s\S]*?height:\s*230px;[\s\S]*?min-height:\s*230px;/
  );
  assert.doesNotMatch(desktop, /(?:transform:\s*scale|zoom:|visibility:\s*hidden)/);
});
```

Update the mobile geometry contract so it verifies that the artwork leaves absolute positioning and returns to normal document flow:

```js
assert.match(
  mobile,
  /\.home-page \.journey-hero__art\s*\{[\s\S]*?position:\s*relative;[\s\S]*?inset:\s*auto;[\s\S]*?order:\s*-1;[\s\S]*?height:\s*auto;/
);
assert.match(
  mobile,
  /\.home-page \.book-hero-picture img\s*\{[\s\S]*?height:\s*auto;[\s\S]*?object-fit:\s*contain;/
);
```

- [ ] **Step 2: Run the focused tests and confirm the new contract fails**

Run:

```bash
node --test tests/ui-contract.test.js
```

Expected: failures for the old `sizes` value, missing absolute full-area artwork geometry, existing radial mask, missing `-80px` story overlap, and missing mobile restoration.

- [ ] **Step 3: Update the responsive image sizing hints**

In both hero `<source>` elements in `index.html`, replace:

```html
sizes="(max-width: 768px) 100vw, (max-width: 1100px) 58vw, 900px"
```

with:

```html
sizes="(max-width: 1500px) 100vw, 1500px"
```

Do not change the source list, formats, dimensions, loading priority, or alt text.

- [ ] **Step 4: Make the watercolor artwork fill the desktop hero**

In the base homepage hero rules in `styles/homepage-book.css`:

```css
.home-page .journey-hero {
  position: relative;
  isolation: isolate;
  display: block;
  width: min(100%, 1500px);
  overflow: visible;
}

.home-page .journey-hero__copy {
  position: relative;
  z-index: 3;
  width: min(44%, 610px);
  max-width: 610px;
}

.home-page .journey-hero__art {
  position: absolute;
  inset: 0;
  z-index: -1;
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  border-radius: 0;
  background: transparent;
  -webkit-mask-image: none;
  mask-image: none;
}

.home-page .book-hero-picture,
.home-page .book-hero-picture img {
  display: block;
  width: 100%;
  height: 100%;
}

.home-page .book-hero-picture img {
  object-fit: cover;
  object-position: center 46%;
  mix-blend-mode: multiply;
}
```

Keep `.journey-hero__art::after` disabled. Do not add gradients that create a visible rectangular or oval image boundary.

- [ ] **Step 5: Match the desktop first-fold spacing and card overlap**

Inside `@media (min-width: 1101px)` in `styles/homepage-book.css`, set:

```css
.home-page .journey-hero {
  min-height: 500px;
  padding: clamp(2rem, 5vw, 4.5rem) clamp(1.5rem, 5vw, 4.5rem) 5rem;
}

.home-page .journey-hero h1 {
  margin-block: 0.45rem 0.75rem;
  font-size: clamp(3.8rem, 4.7vw, 4.8rem);
}

.home-page .book-route--hero {
  bottom: 2.5rem;
  height: 70px;
}

.home-page .stories-section {
  position: relative;
  z-index: 4;
  margin-top: -80px;
  padding-top: 0;
  padding-bottom: 1.25rem;
}

.home-page .stories-section .section-heading,
.home-page .stories-section .filters {
  display: none;
}

.home-page .journey-map {
  margin: 0 auto clamp(4rem, 7vw, 7rem);
  padding-top: 1rem;
}
```

Keep the existing three-column/card width logic, 230 px card height, source labels, story actions, and horizontal overflow for additional stories.

- [ ] **Step 6: Restore an in-flow, uncropped illustration on phones**

Inside the final `@media (max-width: 768px)` block in `styles/homepage-book.css`, use:

```css
.home-page .journey-hero {
  display: flex;
  min-height: auto;
  flex-direction: column;
  padding-top: 0;
}

.home-page .journey-hero__art {
  position: relative;
  inset: auto;
  order: -1;
  z-index: 0;
  width: 116%;
  height: auto;
  margin: 0 -8% -10%;
  overflow: visible;
}

.home-page .book-hero-picture,
.home-page .book-hero-picture img {
  height: auto;
}

.home-page .book-hero-picture img {
  object-fit: contain;
  object-position: center;
}

.home-page .journey-hero__copy {
  width: min(100%, 560px);
  margin-inline: auto;
  text-align: center;
}
```

In mobile rules, reset `.stories-section` to `margin-top: 0` if the desktop overlap leaks through future cascade changes.

- [ ] **Step 7: Run the focused contract suite**

Run:

```bash
node --test tests/ui-contract.test.js
```

Expected: all `ui-contract` tests pass.

- [ ] **Step 8: Run the complete verification**

Run:

```bash
npm run verify
git diff --check
```

Expected: all tests pass, the production build succeeds, and `git diff --check` prints no output.

- [ ] **Step 9: Perform visual and functional checks**

Serve the production build:

```bash
python3 -m http.server 4173 --directory dist
```

Check widths `1536`, `1440`, `1280`, `1024`, `768`, and `390`:

- no visible hero image boundary or oval mask;
- the desktop artwork spans the complete hero;
- the desktop copy stays on the quiet left side;
- Hedgehog and Fox are prominent and not accidentally clipped;
- three complete cards overlap the hero at desktop widths;
- the beginning of the journey map is visible within the first 1000 px;
- no horizontal document overflow;
- the mobile illustration remains proportional and readable;
- navigation links to pricing and parents work on the first click;
- story cards open stories;
- `История от автора` and `Моя история` remain exact;
- both “Мемори” and “Бесконечный полёт” open.

- [ ] **Step 10: Commit the implementation**

```bash
git add tests/ui-contract.test.js index.html styles/homepage-book.css
git commit -m "Match homepage first screen to living book concept"
```

