import { useEffect, useRef } from 'react';
import p5 from 'p5';
import { useComputedColorScheme } from '@mantine/core';

import type { GamePickDraft } from '@/types/submissions';
import { getTeamName } from '@/types/teams';

type RankTeamsProps = {
  matchups: GamePickDraft[];
  value: GamePickDraft[];
  onChange: (ranked: GamePickDraft[]) => void;
};

const ROW_H = 72;
const MAX_CANVAS_W = 380;
const RIGHT_MARGIN = 48;
const PAD = 8;
const BADGE_W = 36;
const SCROLL_ZONE = 80; // px from viewport top/bottom edge that triggers auto-scroll
const MAX_SCROLL_SPEED = 10; // px per frame at the edge

export function RankTeams({ matchups, value, onChange }: RankTeamsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const colorSchemeRef = useRef<'light' | 'dark'>('dark');

  const colorScheme = useComputedColorScheme('dark');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    colorSchemeRef.current = colorScheme;
  }, [colorScheme]);

  const matchupsKey = matchups
    .map((d) => d.matchup.join('-'))
    .sort()
    .join(',');

  useEffect(() => {
    if (!containerRef.current) return;

    const initialOrder: GamePickDraft[] = value.length === matchups.length ? [...value] : [...matchups];

    const availableW = (containerRef.current.parentElement?.clientWidth ?? MAX_CANVAS_W) - RIGHT_MARGIN;
    const canvasW = Math.min(MAX_CANVAS_W, Math.max(200, availableW));

    const sketch = (p: p5) => {
      const n = initialOrder.length;
      const canvasH = n * ROW_H + PAD * 2;

      const slots: RankSlot[] = [];
      let holding = false;
      let itemHeld = -1;
      let mouseCapY = 0;

      class RankSlot {
        draft: GamePickDraft;
        index: number;
        dragging = false;
        y: number;
        dragOffset = 0;

        constructor(draft: GamePickDraft, index: number) {
          this.draft = draft;
          this.index = index;
          this.y = PAD + index * ROW_H;
        }

        startDrag() {
          this.dragging = true;
          this.dragOffset = mouseCapY - this.y;
        }

        endDrag() {
          this.dragging = false;
        }

        update() {
          this.y = this.dragging ? mouseCapY - this.dragOffset : PAD + this.index * ROW_H;
          this.draw();
        }

        draw() {
          const dark = colorSchemeRef.current === 'dark';
          const rank = n - this.index;
          const cardH = ROW_H - 8;
          const rowY = this.y;

          // Card background
          if (this.dragging) {
            if (dark) {
              p.fill(70, 85, 130, 235);
              p.stroke(110, 150, 255);
            } else {
              p.fill(205, 215, 250, 240);
              p.stroke(70, 110, 230);
            }
            p.strokeWeight(1.5);
          } else {
            if (dark) p.fill(40, 42, 54, 215);
            else p.fill(228, 230, 240, 220);
            p.noStroke();
          }
          p.rect(PAD, rowY + 4, canvasW - PAD * 2, cardH, 8);
          p.noStroke();

          // Rank badge
          p.fill(0, 135, 15);
          p.rect(PAD + 5, rowY + 9, BADGE_W, cardH - 10, 6);

          p.fill(255);
          p.textSize(15);
          p.textAlign(p.CENTER, p.CENTER);
          p.text(rank, PAD + 5 + BADGE_W / 2, rowY + 9 + (cardH - 10) / 2);

          // Matchup label: "WinnerFull (vs LoserMascot)"
          const [teamA, teamB] = this.draft.matchup;
          const winnerID = this.draft.winner ?? teamA;
          const loserID = winnerID === teamA ? teamB : teamA;
          const label = `${getTeamName(winnerID, 'full')} (vs ${getTeamName(loserID, 'mascot')})`;
          const textX = PAD + 5 + BADGE_W + 12;
          const handleX = canvasW - PAD - 14;
          const textW = handleX - 8 - textX;
          const fontSize = 14;
          const lineH = 20;
          p.textSize(fontSize);
          p.textLeading(lineH);
          const numLines = p.textWidth(label) <= textW ? 1 : 2;
          const blockH = numLines * lineH;
          const textStartY = rowY + 4 + (cardH - blockH) / 2;
          p.textAlign(p.LEFT, p.TOP);
          if (dark) p.fill(235, 237, 255);
          else p.fill(20, 22, 35);
          p.text(label, textX, textStartY, textW, blockH);

          // Drag handle dots
          if (dark) p.fill(110, 115, 145);
          else p.fill(140, 145, 165);
          const hx = canvasW - PAD - 14;
          const hy = rowY + 4 + cardH / 2;
          for (let dr = -5; dr <= 5; dr += 5) {
            p.circle(hx - 3, hy + dr, 3);
            p.circle(hx + 3, hy + dr, 3);
          }
        }
      }

      p.setup = () => {
        const canvas = p.createCanvas(canvasW, canvasH);
        canvas.parent(containerRef.current!);
        // Prevent page scroll while dragging on touch devices
        canvas.elt.style.touchAction = 'none';
        canvas.elt.addEventListener('touchmove', (e: Event) => e.preventDefault(), { passive: false });
        p.textFont('sans-serif');

        initialOrder.forEach((draft, i) => {
          slots.push(new RankSlot(draft, i));
        });
      };

      const slotAtY = (my: number) => {
        let idx = Math.floor((my - PAD) / ROW_H);
        if (idx < 0) idx = 0;
        if (idx >= n) idx = n - 1;
        return idx;
      };

      // --- Auto-scroll while dragging near viewport edges ---
      let scrollRAF: number | null = null;

      const swapToSlot = (over: number) => {
        if (itemHeld === -1 || over === itemHeld) return;
        slots[over].index = itemHeld;
        slots[itemHeld].index = over;
        [slots[itemHeld], slots[over]] = [slots[over], slots[itemHeld]];
        itemHeld = over;
      };

      const tickAutoScroll = () => {
        if (!holding) {
          scrollRAF = null;
          return;
        }

        const winY = p.winMouseY;
        const viewH = window.innerHeight;
        let speed = 0;
        if (winY < SCROLL_ZONE) {
          speed = -MAX_SCROLL_SPEED * (1 - winY / SCROLL_ZONE);
        } else if (winY > viewH - SCROLL_ZONE) {
          speed = MAX_SCROLL_SPEED * (1 - (viewH - winY) / SCROLL_ZONE);
        }

        if (speed !== 0) {
          window.scrollBy(0, speed);
          // Canvas moved under the cursor — adjust the captured drag Y so the
          // held item tracks correctly even though no mouse event fired.
          mouseCapY = Math.max(0, Math.min(canvasH, mouseCapY + speed));
          swapToSlot(slotAtY(mouseCapY));
          scrollRAF = requestAnimationFrame(tickAutoScroll);
        } else {
          scrollRAF = null;
        }
      };

      const cancelAutoScroll = () => {
        if (scrollRAF !== null) {
          cancelAnimationFrame(scrollRAF);
          scrollRAF = null;
        }
      };
      // ------------------------------------------------------

      const dragStarted = () => {
        const mx = p.mouseX;
        const my = p.mouseY;
        if (mx < 0 || my < 0 || mx > canvasW || my > canvasH) return;
        mouseCapY = my;
        holding = true;
        itemHeld = slotAtY(my);
        slots[itemHeld].startDrag();
      };

      const draggingOver = () => {
        if (!holding) return;
        mouseCapY = p.mouseY;
        if (mouseCapY >= 0 && mouseCapY <= canvasH) {
          swapToSlot(slotAtY(mouseCapY));
        }
        // Kick off the auto-scroll RAF loop if not already running
        if (scrollRAF === null) scrollRAF = requestAnimationFrame(tickAutoScroll);
      };

      const dragStopped = () => {
        holding = false;
        cancelAutoScroll();
        if (itemHeld !== -1) {
          slots[itemHeld].endDrag();
          itemHeld = -1;
        }
        onChangeRef.current(slots.map((s) => s.draft));
      };

      // @types/p5 omits touch handlers — cast to reach them
      (p as unknown as Record<string, unknown>).touchStarted = dragStarted;
      (p as unknown as Record<string, unknown>).touchMoved = draggingOver;
      (p as unknown as Record<string, unknown>).touchEnded = dragStopped;
      p.mousePressed = () => dragStarted();
      p.mouseDragged = () => draggingOver();
      p.mouseReleased = () => dragStopped();

      p.draw = () => {
        p.clear();
        // Draw non-held items first, held item on top
        for (let i = 0; i < slots.length; i++) {
          if (i !== itemHeld) slots[i].update();
        }
        if (holding && itemHeld !== -1) {
          slots[itemHeld].update();
        }
      };
    };

    const myP5 = new p5(sketch);
    return () => myP5.remove();
    // Only re-init when the set of matchups changes; value/onChange are intentionally handled via refs
  }, [matchupsKey]);

  return <div ref={containerRef} style={{ display: 'inline-block', userSelect: 'none' }} />;
}

export default RankTeams;
