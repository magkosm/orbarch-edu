# Workshop feedback & debrief

Notes from the first large-scale pilot and follow-up planning. Use this when revising
materials, training facilitators, or prioritising product work.

## Pilot run (summary)

| | |
| --- | --- |
| **Scale** | 60 students total, run in **3 sequential groups of ~20** |
| **Structure** | Revised after pilot — see [workshop plans](../workshop-en.md) (Blocks A–D) and [slides-outline.md](./slides-outline.md) |
| **Devices** | Students used **their own phones**; apps **mostly worked** |
| **Browser** | **Safari was occasionally quirky** — Chrome generally smoother if students hit issues |

---

## What worked well

### Habitat Blueprint Designer

The Blueprint activity was **highly successful** — engaging enough that some students
treated it as almost **addictive**. It communicated **design trade-offs** clearly:
students had to balance crew cognition, mission value (Science / Health / Life Support),
and layout constraints.

**Recommendation:** **Enrich this activity** in future workshop versions (more scenarios,
debrief prompts, optional extension missions).

### MATB (for some students)

Several students engaged strongly with the **MATB 2-min** battery and returned with
**near-perfect scores**, which made the baseline vs. stressed comparison meaningful
when discussed as a class.

### Overall flow

Running the full ~90–120 minute flow on phones in a classroom setting is **viable at scale**
(three back-to-back groups of 20).

---

## Friction & gaps

### MATB — uneven uptake

Some students struggled with MATB, either because of **task complexity** or a **language
gap** (instructions / multitasking load). Others had no difficulty.

**For facilitators:**

- Demo the four tasks briefly before the quiet baseline run.
- Pair students who struggle with a stronger partner; one device per pair still works.
- Do not assume every student will finish with a usable score — the *comparison* is the
  learning goal, not individual perfection.

### Blueprint — corridor / pathway access

The mission brief requires a **clear corridor from the entrance (🚪) to every module**.
This rule had to be **explained and repeated multiple times** during the pilot.

**Product gap:** a dedicated **pathway-access visualisation tool** (show reachable
cells, highlight blocked modules, maybe animate a path from the airlock) would reduce
facilitator repetition and help students self-correct.

The Blueprint already marks inaccessible modules in red; making access rules **more
discoverable in-app** (tutorial hint, checklist item, or toggle overlay) is a priority
for the next iteration.

### Safari

Expect occasional Safari-specific behaviour (audio, fullscreen, tab focus). If a student
reports odd behaviour, **switch to Chrome** first before debugging further.

---

## ESERO Greece — nationwide deployment (11 Jun 2026)

On **Thursday 11 June 2026** we met with **ESERO Greece** about **nationwide deployment**
of the workshop and tools.

Deployment at that scale would benefit from:

- **Stronger advance planning** (scheduling, device readiness, Wi-Fi, room setup)
- **Train-the-trainer materials** — condensed facilitator guide, video walkthroughs,
  FAQ for common phone/browser issues
- **Localised teacher support** (Greek materials exist; ensure parity with EN/SV updates)
- **Pilot learnings above** baked into slides and teacher notes before roll-out

---

## Product backlog (workshop-related)

### Hidden teacher / facilitator area

A **teacher-only section** (on this site or a companion page) could support classroom
deployment and research tracking:

| Feature | Purpose |
| --- | --- |
| **Classroom goals** | Teacher sets learning objectives or mission targets for the session |
| **School registration** | Input school name, country, and **number of students** |
| **Participation map** | Map of schools that have run the workshop (aggregated, privacy-safe) |
| **Facilitator shortcuts** | Links to all tools, QR sheet generator, optional "demo mode" |

This complements printed teacher notes and would help ESERO-style national programmes
report reach and standardise facilitation.

### Blueprint enhancements

- Pathway-access overlay / tutorial (see above)
- Additional scenarios or "Mission Success 85+" stretch goals for fast finishers
- Richer debrief slide prompts tied to trade-offs students actually made

### MATB / onboarding

- Shorter "practice round" or simplified intro mode before the 2-min scored run
- Clearer in-app task labels for non-native speakers

---

## Revision checklist (materials)

- [x] Teacher notes: Safari tip, MATB projector demo before student QR, **repeat corridor-to-entrance rule**
- [x] Slides: full deck per [`slides-outline.md`](./slides-outline.md) (history, Wandt photo, whiteboard prompts)
- [x] Workshop overview PDF for coordinators / schools (`workshop-overview-*.html`)
- [ ] Train-the-trainer one-pager for ESERO Greece deployment
- [x] Regenerate stale PDFs: `teacher-notes-sv.pdf`, `teacher-notes-el.pdf`, `handout-el.pdf`
- [ ] Product: pathway-access UX in Blueprint Designer
- [ ] Product: teacher portal (goals, school signup, map) — spec TBD
- [ ] Finished slide decks: `slides-en.pptx`, `slides-sv.pptx`, `slides-el.pptx` (still placeholders)
