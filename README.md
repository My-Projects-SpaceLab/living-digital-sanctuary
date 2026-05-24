# Living Digital Sanctuary

**[→ Open it](https://my-projects-spacelab.github.io/living-digital-sanctuary/)** &nbsp;·&nbsp; No login. No sign-up. Just open it.

---
I’ve been building Stack-rot(https://github.com/varalaakshay-arch/stack-rot)  for a while now. Long work sessions, late evenings, the usual kind of work that quietly drains you without announcing it.

At some point I noticed I kept switching away from what I was doing. Not even to anything specific. Just… somewhere else. Another tab, scrolling, anything that wasn’t the task. It wasn’t really distraction. It felt more like my brain needed a break in between things, but nothing I tried actually gave that.

Meditation apps felt like I had to “do it properly.”
Focus timers just added structure.
Most things still felt like work, just in a different form.

So I built this instead.

It's a space that reads how you're doing — just from how you type, how fast, how long you pause — and quietly shifts around you. When you're in flow it stays alive and present. When you're running empty it slows down, warms up, and stops asking anything of you.
You don't have to do anything. That's the whole point.

---

## What happens

The interface watches your typing rhythm. Not what you write — how you write it. Speed, pauses, the gaps between thoughts. From that it figures out where you are and adjusts the visual field around you.

| | |
|---|---|
| **Flow** | You're in good shape. The field is cool blue, fluid, present. |
| **Drift** | Slowing down. Colors warm, motion softens, the card fades back. |
| **Restore** | You've gone quiet. Warm amber, barely-there interface, just the breathing field. |

Transitions are slow enough that you don't notice them happening. You just notice, later, that you feel different.

---

## Try it

**[Open the Sanctuary →](https://my-projects-spacelab.github.io/living-digital-sanctuary/)**

Write something. Anything. Stop after a couple of minutes and just watch what happens to the field.

---

## Where this comes from

This isn't a vibe project. Everything in it has a research basis:

- **Attention Restoration Theory** (Kaplan & Kaplan, 1989) — slow, organic, non-demanding motion lets the directed attention system actually recover. The same reason you feel better after sitting near water.
- **Stress Recovery Theory** (Ulrich, 1984) — natural color ranges and biophilic visual patterns measurably reduce cortisol within minutes.
- **Calm Technology** (Weiser & Brown, Xerox PARC, 1995) — technology should live in the periphery, shift to center only when needed, then return.
- **Biocybernetic interfaces** — typing speed is a reliable passive signal of cognitive state. Adapting visual complexity to it produces real focus improvements.

This is that attempt to put all four of these together in one interface.

---

## Under the hood

- Vanilla JS + Canvas API, no frameworks, no dependencies
- Layered sine-based flow fields for organic motion
- Exponential lerp transitions — state changes take 8–20 seconds, imperceptible by design
- Passive interaction sensing only — no data leaves your browser, ever

---

## Sanctuary Reports

If you used it and felt something — or didn't — I'd genuinely like to know.

**[Leave a report →](https://my-projects-spacelab.github.io/living-digital-sanctuary/about.html)**

---

*Built because I needed it. Sharing it in case you do too.*
