import { roomAt } from "/shared/special.mjs";

// Static, deterministic irregularities keep the print distressed without moving text.
export function distressedText(element, text = element.textContent) {
  element.setAttribute("aria-label", text);
  element.replaceChildren(
    ...Array.from(text, (letter, i) => {
      if (!/[a-z]/i.test(letter)) return document.createTextNode(letter);
      const span = document.createElement("span");
      span.className = "ink-letter";
      span.setAttribute("aria-hidden", "true");
      span.textContent = letter;
      span.style.setProperty(
        "--letter-scale",
        [1, 1.07, 0.97, 1, 1.03, 0.96, 1][i % 7],
      );
      return span;
    }),
  );
}

const roomNames = {
  "west-0": "The Library",
  "west-1": "The Dining Room",
  "west-2": "The Chapel",
  "east-0": "The Bathroom",
  "east-1": "The Kitchen",
  "east-2": "The Master Bedroom",
  corridor: "The Corridor",
};

export class InterfaceView {
  constructor() {
    this.video = document.getElementById("entranceVideo");
    this.notice = document.getElementById("roomEntry");
    this.stats = { room: null, roomNotices: 0, outcome: null };
    document
      .querySelectorAll("[data-distort]")
      .forEach((el) => distressedText(el));
    this.playing = false;
    void this.video.play().catch(() => {});
  }
  setPlaying(playing) {
    if (this.playing === playing) return;
    this.playing = playing;
    document.body.classList.toggle("in-match", playing);
    if (playing) this.video.pause();
    else void this.video.play().catch(() => {});
    if (!playing) {
      this.key = null;
      this.notice.classList.remove("show-room");
    }
  }
  updateRoom(position, round, stage) {
    if (!this.playing || !position || !["hide", "search"].includes(stage))
      return;
    const name = roomNames[roomAt(position)],
      key = `${round}:${name}`;
    if (key === this.key) return;
    this.key = key;
    this.stats.room = name;
    this.stats.roomNotices++;
    document.getElementById("roomName").textContent = name;
    this.notice.classList.remove("show-room");
    // Restart only on entry, never when a borrowed camera moves to another room.
    void this.notice.offsetWidth;
    this.notice.classList.add("show-room");
  }
  showOutcome(outcome) {
    this.stats.outcome = outcome;
    const dialog = document.getElementById("results");
    dialog.dataset.outcome = outcome;
    const copy = {
      win: [
        "THE HOUSE LET YOU LEAVE",
        "You won.",
        "Adrenaline is the drug. Tonight, you survived.",
      ],
      loss: [
        "ANOTHER NAME IN THE WALLS",
        "You lost.",
        "Death knocked. You opened the door.",
      ],
      draw: [
        "THE HOUSE KEEPS YOU BOTH",
        "A draw in the dark.",
        "Two witnesses. Neither gets the last word.",
      ],
    }[outcome];
    document.getElementById("resultbadge").textContent = copy[0];
    distressedText(document.getElementById("resulttitle"), copy[1]);
    document.getElementById("resultcaption").textContent = copy[2];
  }
}
