(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE = "pocket-morning-v1";
  const STORY = window.RPG_STORY;
  const portraits = { 루카: 98, 미나: 99, 마르타: 86, 오웬: 100 };
  const defaults = () => ({
    stage: 0,
    completed: false,
    begun: false,
    visited: [],
    choice: null,
    textSpeed: 24,
    muted: false,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    position: null,
  });
  function readSave() {
    const result = defaults();
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE));
      if (!s || typeof s !== "object") return result;
      result.stage = [0, 1, 2].includes(s.stage) ? s.stage : 0;
      result.completed = s.completed === true && result.stage === 2;
      result.begun = s.begun === true;
      result.visited = Array.isArray(s.visited)
        ? s.visited.filter((id) =>
            ["well", "cat", "owen", "chest", "sign", "bag"].includes(id),
          )
        : [];
      result.choice = [0, 1].includes(s.choice) ? s.choice : null;
      result.textSpeed = [0, 12, 24].includes(s.textSpeed) ? s.textSpeed : 24;
      result.muted = s.muted === true;
      if (typeof s.reducedMotion === "boolean")
        result.reducedMotion = s.reducedMotion;
      if (
        s.position &&
        Number.isFinite(s.position.x) &&
        Number.isFinite(s.position.y)
      )
        result.position = { x: s.position.x, y: s.position.y };
    } catch (_) {
      /* Private browsing and disabled storage still allow playing. */
    }
    return result;
  }
  class Morning {
    constructor() {
      this.state = readSave();
      this.started = false;
      this.ready = false;
      this.inDialogue = false;
      this.ending = false;
      this.queue = [];
      this.keys = {};
      this.modalOpen = false;
      this.typing = null;
      this.toastTimer = null;
      this.history = [];
      this.near = null;
      this.audio = new window.MorningAudio();
      this.bindUI();
      this.applySettings();
      window.addEventListener("error", (event) => {
        if (!this.ready) this.loadError();
      });
      this.loadTimer = setTimeout(() => {
        if (!this.ready) this.loadError();
      }, 18000);
      if (!window.Phaser || !window.RPG_WORLD || !STORY) {
        this.loadError();
        return;
      }
      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: "game",
        backgroundColor: "#8cc269",
        pixelArt: true,
        roundPixels: true,
        antialias: false,
        banner: false,
        audio: { noAudio: true },
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: $("game").clientWidth,
          height: $("game").clientHeight,
        },
        scene: window.RPG_WORLD.Village,
        render: { roundPixels: true, antialias: false },
        input: { activePointers: 3 },
      });
      this.saveTimer = setInterval(() => {
        if (this.started) this.save();
      }, 2000);
    }
    loadError() {
      $("load-error").hidden = false;
    }
    onWorldReady(world) {
      clearTimeout(this.loadTimer);
      this.world = world;
      this.ready = true;
      $("start-button").textContent = "아침을 시작하기";
      $("start-button").disabled = false;
      $("continue-button").hidden = !this.state.begun;
      this.setPortrait(document.querySelector(".player-avatar"), 98, true);
      this.drawMap();
    }
    setPortrait(element, frame, avatar = false) {
      if (frame === undefined) {
        element.style.backgroundImage = "none";
        element.textContent = "✦";
        element.style.color = "#b6a16e";
        return;
      }
      element.textContent = "";
      const scale = avatar && innerWidth <= 760 ? 1.8 : 2;
      element.style.backgroundImage =
        'url("assets/kenney-tiny-dungeon/Tilemap/tilemap_packed.png")';
      element.style.backgroundSize = `${192 * scale}px ${176 * scale}px`;
      element.style.backgroundPosition = `${-((frame % 12) * 16) * scale + (avatar && innerWidth > 760 ? 6 : 0)}px ${-Math.floor(frame / 12) * 16 * scale + (avatar && innerWidth > 760 ? 7 : 0)}px`;
    }
    bindUI() {
      $("start-button").addEventListener("click", () => this.start(false));
      $("continue-button").addEventListener("click", () => this.start(true));
      $("dialogue-next").addEventListener("click", (e) => {
        e.stopPropagation();
        this.nextLine();
      });
      $("dialogue").addEventListener("click", (e) => {
        if (!e.target.closest("button")) this.nextLine();
      });
      $("interact-button").addEventListener("click", () => {
        if (this.inDialogue) this.nextLine();
        else this.interact(this.near);
      });
      $("explore-button").addEventListener("click", () => {
        this.ending = false;
        $("ending-screen").hidden = true;
        this.updateQuest();
        this.world.nearestId = null;
      });
      $("sound-button").addEventListener("click", () => this.toggleSound());
      $("journal-button").addEventListener("click", () => {
        this.renderJournal();
        this.openModal("journal-modal");
      });
      $("menu-button").addEventListener("click", () =>
        this.openModal("settings-modal"),
      );
      $("map-button").addEventListener("click", () => {
        this.drawMap(true);
        this.openModal("map-modal");
      });
      document
        .querySelectorAll("[data-close]")
        .forEach((button) =>
          button.addEventListener("click", () =>
            button.closest("dialog").close(),
          ),
        );
      document.querySelectorAll("dialog").forEach((dialog) => {
        dialog.addEventListener("close", () => {
          this.modalOpen = false;
          this.clearKeys();
          $("restart-confirm").hidden = true;
        });
        dialog.addEventListener("click", (e) => {
          if (e.target === dialog) {
            const box = dialog.getBoundingClientRect();
            if (
              e.clientX < box.left ||
              e.clientX > box.right ||
              e.clientY < box.top ||
              e.clientY > box.bottom
            )
              dialog.close();
          }
        });
      });
      $("text-speed").addEventListener("change", (e) => {
        this.state.textSpeed = Number(e.target.value);
        this.save();
        if (this.inDialogue) this.finishTyping();
      });
      $("reduced-motion").addEventListener("change", (e) => {
        this.state.reducedMotion = e.target.checked;
        this.applySettings();
        this.save();
      });
      $("restart-button").addEventListener("click", () => {
        $("restart-confirm").hidden = false;
      });
      $("confirm-restart").addEventListener("click", () => {
        $("settings-modal").close();
        this.start(false);
      });
      document.querySelectorAll("[data-dir]").forEach((button) => {
        const direction = button.dataset.dir;
        button.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (!this.canMove()) return;
          button.setPointerCapture(e.pointerId);
          this.keys[direction] = true;
          button.classList.add("active");
        });
        const release = () => {
          this.keys[direction] = false;
          button.classList.remove("active");
        };
        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
        button.addEventListener("lostpointercapture", release);
      });
      const arrows = {
        ArrowUp: "up",
        w: "up",
        W: "up",
        ArrowDown: "down",
        s: "down",
        S: "down",
        ArrowLeft: "left",
        a: "left",
        A: "left",
        ArrowRight: "right",
        d: "right",
        D: "right",
      };
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          this.clearKeys();
          if (this.modalOpen) return;
          return;
        }
        if (this.modalOpen || e.target.matches("input,select,textarea")) return;
        if (arrows[e.key]) {
          if (this.started) e.preventDefault();
          if (this.canMove()) this.keys[arrows[e.key]] = true;
          return;
        }
        if (e.repeat) return;
        if (e.key === " " || e.key === "Enter") {
          if (e.target.closest("button,a")) return;
          if (this.started) {
            e.preventDefault();
            if (this.inDialogue) this.nextLine();
            else if (!this.ending) this.interact(this.near);
          }
        }
        if (e.key === "m" || e.key === "M") this.toggleSound();
        if (e.key === "j" || e.key === "J") {
          this.renderJournal();
          this.openModal("journal-modal");
        }
      });
      document.addEventListener("keyup", (e) => {
        if (arrows[e.key]) this.keys[arrows[e.key]] = false;
      });
      window.addEventListener("blur", () => this.clearKeys());
      window.addEventListener("pagehide", () => this.save());
      document.addEventListener("visibilitychange", () => {
        this.clearKeys();
        if (document.hidden) {
          this.audio.pause();
          this.save();
        } else if (this.started)
          this.audio.resume().then(() => this.updateSound());
      });
      window.addEventListener("resize", () =>
        this.setPortrait(document.querySelector(".player-avatar"), 98, true),
      );
    }
    applySettings() {
      document.documentElement.classList.toggle(
        "reduced-motion",
        this.state.reducedMotion,
      );
      $("text-speed").value = String(this.state.textSpeed);
      $("reduced-motion").checked = this.state.reducedMotion;
    }
    clearKeys() {
      this.keys = {};
      document
        .querySelectorAll("[data-dir]")
        .forEach((b) => b.classList.remove("active"));
    }
    canMove() {
      return (
        this.started &&
        !this.inDialogue &&
        !this.ending &&
        !this.modalOpen &&
        !document.hidden
      );
    }
    start(resume) {
      if (!this.ready) return;
      clearInterval(this.typing);
      this.typing = null;
      this.inDialogue = false;
      this.ending = false;
      this.afterDialogue = null;
      this.clearKeys();
      $("dialogue").hidden = true;
      $("ending-screen").hidden = true;
      $("title-screen").hidden = true;
      $("hud").hidden = false;
      document.querySelector(".app-shell").classList.add("started");
      if (!resume) {
        const settings = {
          textSpeed: this.state.textSpeed,
          muted: this.state.muted,
          reducedMotion: this.state.reducedMotion,
        };
        this.state = { ...defaults(), ...settings };
        this.history = [];
      }
      this.started = true;
      this.state.begun = true;
      this.world.activate(resume ? this.state.position : null);
      this.near = null;
      this.world.nearestId = null;
      this.onNearby(null);
      this.updateQuest();
      this.save();
      this.audio.setEnabled(!this.state.muted).then(() => this.updateSound());
      $("start-button").blur();
      $("continue-button").blur();
      if (!resume)
        this.dialogue(STORY.conversations.wake, () => {
          this.toast("새로운 아침! 마르타에게 인사해 보자.");
          this.save();
        });
      else this.toast("좋아. 아까 걷던 길부터!");
    }
    save() {
      if (this.started && this.world?.player)
        this.state.position = {
          x: this.world.player.x,
          y: this.world.player.y,
        };
      try {
        localStorage.setItem(STORAGE, JSON.stringify(this.state));
      } catch (_) {}
    }
    async toggleSound() {
      this.state.muted = this.audio.enabled;
      await this.audio.setEnabled(!this.state.muted);
      this.updateSound();
      this.save();
    }
    updateSound() {
      const on = this.audio.enabled;
      $("sound-button").setAttribute("aria-pressed", String(on));
      $("sound-button").setAttribute(
        "aria-label",
        on ? "소리 끄기" : "소리 켜기",
      );
      $("sound-label").textContent = on ? "소리 켬" : "소리 끔";
      $("sound-symbol").style.opacity = on ? "1" : ".5";
    }
    openModal(id) {
      this.clearKeys();
      this.modalOpen = true;
      $(id).showModal();
    }
    updateQuest() {
      const quests = [
        ["빵집의 마르타에게 인사하기", "빵 냄새가 나는 곳. 바로 저 앞이다."],
        ["북쪽 꽃밭에 빵 배달하기", "분수를 지나 북쪽, 미나를 찾아보자."],
        ["첫 번째 심부름, 완료!", "남은 아침은 자유롭게 둘러보자."],
      ];
      const [title, detail] = quests[this.state.stage];
      $("quest-text").textContent = title;
      $("quest-detail").textContent = detail;
      $("pocket-text").textContent =
        this.state.stage === 1 ? "주머니 · 빵 꾸러미" : "주머니 · 0 G";
    }
    onNearby(id) {
      this.near = id;
      if (this.inDialogue) {
        $("interact-button").disabled = false;
        $("interact-label").textContent = "다음 대사";
        $("nearby").textContent = "한 번 더 눌러 계속";
        return;
      }
      const p = window.RPG_WORLD.POSITIONS[id];
      $("interact-button").disabled = !id || !this.started || this.ending;
      $("interact-label").textContent = p
        ? p.frame !== undefined || id === "cat"
          ? "대화하기"
          : "살펴보기"
        : "둘러보기";
      $("nearby").textContent = p ? p.name : "사람이나 물건 곁으로";
    }
    dialogue(lines, after) {
      this.clearKeys();
      this.world.route = [];
      this.world.walkTarget = null;
      this.inDialogue = true;
      this.queue = lines.map((line) => ({ ...line }));
      this.lineIndex = 0;
      this.afterDialogue = after;
      $("dialogue").hidden = false;
      $("dialogue-choices").hidden = true;
      $("dialogue-next").hidden = false;
      this.onNearby(this.near);
      this.showLine();
    }
    showLine() {
      clearInterval(this.typing);
      this.typing = null;
      const line = this.queue[this.lineIndex];
      if (!line) {
        this.endDialogue();
        return;
      }
      $("speaker").textContent = line.speaker || "라온 마을";
      this.setPortrait($("portrait"), portraits[line.speaker]);
      $("dialogue-count").textContent =
        `${this.lineIndex + 1} / ${this.queue.length}`;
      this.currentText = line.text;
      this.textIndex = 0;
      $("dialogue-text").textContent = "";
      if (this.state.textSpeed === 0) {
        $("dialogue-text").textContent = line.text;
        this.textIndex = line.text.length;
      } else
        this.typing = setInterval(() => {
          if (document.hidden || this.modalOpen) return;
          this.textIndex++;
          $("dialogue-text").textContent = this.currentText.slice(
            0,
            this.textIndex,
          );
          if (this.textIndex >= this.currentText.length) {
            clearInterval(this.typing);
            this.typing = null;
          }
        }, this.state.textSpeed);
      this.audio.effect("talk");
    }
    finishTyping() {
      if (this.typing) {
        clearInterval(this.typing);
        this.typing = null;
        $("dialogue-text").textContent = this.currentText;
        this.textIndex = this.currentText.length;
        return true;
      }
      return false;
    }
    nextLine() {
      if (!this.inDialogue || this.modalOpen || !$("dialogue-choices").hidden)
        return;
      if (this.finishTyping()) return;
      this.lineIndex++;
      this.showLine();
    }
    endDialogue() {
      clearInterval(this.typing);
      this.typing = null;
      this.inDialogue = false;
      $("dialogue").hidden = true;
      const after = this.afterDialogue;
      this.afterDialogue = null;
      this.onNearby(this.near);
      if (after) after();
    }
    offerChoice() {
      this.inDialogue = true;
      $("dialogue").hidden = false;
      $("speaker").textContent = "루카";
      this.setPortrait($("portrait"), 98);
      $("dialogue-text").textContent = "오늘은 뭘 할까?";
      $("dialogue-count").textContent = "작은 대답 하나";
      $("dialogue-next").hidden = true;
      const choices = $("dialogue-choices");
      choices.replaceChildren();
      choices.hidden = false;
      STORY.choices.girlReply.forEach((choice, index) => {
        const button = document.createElement("button");
        button.textContent = choice.label;
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          this.state.choice = index;
          choices.hidden = true;
          this.dialogue([...choice.reply, ...STORY.conversations.ending], () =>
            this.complete(),
          );
        });
        choices.append(button);
      });
      this.onNearby(this.near);
    }
    complete() {
      this.state.stage = 2;
      this.state.completed = true;
      this.ending = true;
      $("ending-screen").hidden = false;
      this.updateQuest();
      this.onNearby(null);
      this.audio.effect("quest");
      this.save();
    }
    interact(id) {
      if (!id || !this.canMove() || this.world.distanceTo(id) > 78) return;
      const c = STORY.conversations;
      if (id === "marta") {
        if (this.state.stage === 0)
          this.dialogue(c.bakerIntro, () => {
            this.state.stage = 1;
            this.updateQuest();
            this.audio.effect("quest");
            this.toast("빵 꾸러미를 받았다 · 북쪽 꽃밭으로!");
            this.save();
          });
        else if (this.state.stage === 1) this.dialogue(c.bakerRepeat);
        else
          this.dialogue([
            {
              speaker: "마르타",
              text: "잘 전해 줬니? 그래, 잘했다. 앞머리는 또 왜 그렇게 반듯해졌어?",
            },
            { speaker: "루카", text: "심부름도 용모 단정하게 해야죠!" },
          ]);
      } else if (id === "mina") {
        if (this.state.stage === 0) this.dialogue(c.girlBefore);
        else if (this.state.stage === 1)
          this.dialogue(c.girlDelivery, () => this.offerChoice());
        else
          this.dialogue([
            {
              speaker: "미나",
              text: "루카, 빵 잘 먹었어. 모험 얘기는 나중에 들려줘!",
            },
            { speaker: "루카", text: "응. 그럼 들려줄 얘기부터 만들고 올게." },
          ]);
      } else {
        if (!this.state.visited.includes(id)) this.state.visited.push(id);
        if (id === "owen" && this.state.stage === 0)
          this.dialogue([
            {
              speaker: "오웬",
              text: "좋은 아침이다. 정원에 온 김에 꽃은 보고 가렴. 아직 빵은 안 왔구나.",
            },
            { speaker: "루카", text: "빵이요? 그 소식은 제가 알아오죠!" },
          ]);
        else if (id === "owen")
          this.dialogue(
            this.state.stage === 2
              ? [
                  {
                    speaker: "오웬",
                    text: "잘 먹었다. 빵을 먹고 나니 잡초도 좀 덜 얄밉구나.",
                  },
                  {
                    speaker: "루카",
                    text: "저도 그래요. 배가 부르면 웬만한 건 다 괜찮죠.",
                  },
                ]
              : c.gardener,
          );
        else if (id === "well") this.dialogue(c.well);
        else if (id === "cat") {
          this.audio.effect("cat");
          this.dialogue(
            this.state.stage === 0
              ? [
                  { speaker: "고양이", text: "먀아." },
                  {
                    speaker: "루카",
                    text: "나도 배고파. 빵집 앞에서는 우리 둘 다 경쟁자라고.",
                  },
                ]
              : this.state.stage === 2
                ? [
                    { speaker: "고양이", text: "먀아." },
                    {
                      speaker: "루카",
                      text: "이번엔 정말 빈손이야. 다음에 생기면 조금 남겨 올게.",
                    },
                  ]
                : c.cat,
          );
        } else if (id === "sign")
          this.dialogue([
            {
              speaker: "",
              text: "북쪽 — 공동 정원\n서쪽 — 마르타의 빵집\n동쪽 — 냇가와 잡화점",
            },
            { speaker: "루카", text: "그리고 저 길 너머로는… 아주 넓은 세상." },
          ]);
        else if (id === "bag")
          this.dialogue([
            {
              speaker: "",
              text: "해진 자루 안에는 납작한 돌 하나, 단추 두 개, 길에서 주운 깃털이 들어 있다.",
            },
            {
              speaker: "루카",
              text: "깃털은 챙겨 둬야지. 모험 일지를 쓰게 될지도 모르니까.",
            },
          ]);
        else if (id === "chest")
          this.dialogue([
            {
              speaker: "",
              text: "상자 안에는 오래된 지도 조각이 있었다. 누군가 마을 바깥에 별을 그려 두었다.",
            },
            {
              speaker: "루카",
              text: "보물인가? 아니면 맛있는 빵집? 어느 쪽이든 나쁘지 않은데!",
            },
          ]);
        this.save();
      }
    }
    toast(message) {
      clearTimeout(this.toastTimer);
      $("toast").textContent = message;
      $("toast").hidden = false;
      this.toastTimer = setTimeout(() => ($("toast").hidden = true), 3200);
    }
    renderJournal() {
      const content = $("journal-content");
      content.replaceChildren();
      const entries = [
        [
          "아침",
          "꿈속에서는 괴물을 물리치기 직전이었다. 다음엔 조금 더 늦게 깨도 좋겠는데.",
        ],
      ];
      if (!this.state.begun)
        entries[0] = [
          "새 페이지",
          "아직 아무것도 쓰지 않은 수첩. 오늘부터 채워 보자.",
        ];
      else if (this.state.stage === 0)
        entries.push([
          "오늘 할 일",
          "마르타에게 인사하기. 빵 냄새를 따라가면 된다.",
        ]);
      if (this.state.stage >= 1)
        entries.push([
          "첫 번째 심부름",
          "북쪽 정원의 미나와 오웬에게 빵을 배달한다. 내 몫의 작은 빵은 벌써 먹었다.",
        ]);
      if (this.state.visited.includes("well"))
        entries.push([
          "분수 옆",
          "세수도 했고, 머리도 정리했다. 이제 준비 완료.",
        ]);
      if (this.state.visited.includes("cat"))
        entries.push([
          "길 위의 고양이",
          "통행료 협상은 결렬. 일단 옆으로 지나가기로 했다.",
        ]);
      if (this.state.visited.includes("chest"))
        entries.push([
          "오래된 지도",
          "마을 밖에 별이 그려져 있다. 언젠가 직접 확인해 보자.",
        ]);
      if (this.state.completed)
        entries.push([
          "미나를 만나고",
          "빵 배달을 마쳤다. 오늘은 들려줄 만한 모험을 하나 찾아보자.",
        ]);
      for (const [label, text] of entries) {
        const entry = document.createElement("div");
        entry.className = "note-entry";
        const small = document.createElement("small");
        small.textContent = label;
        const p = document.createElement("p");
        p.textContent = text;
        entry.append(small, p);
        content.append(entry);
      }
      const pocket = document.createElement("p");
      pocket.className = "note-pocket";
      pocket.textContent =
        this.state.stage === 1
          ? "소지품 · 빵 꾸러미, 납작한 돌, 깃털"
          : "소지품 · 납작한 돌, 깃털, 아직 빈 동전 주머니";
      content.append(pocket);
    }
    drawMap(big = false) {
      if (!this.world?.ground) return;
      for (const canvas of [
        $("minimap"),
        ...(big || $("map-modal").open ? [$("big-map")] : []),
      ]) {
        const ctx = canvas.getContext("2d"),
          sx = canvas.width / 40,
          sy = canvas.height / 30;
        for (let y = 0; y < 30; y++)
          for (let x = 0; x < 40; x++) {
            ctx.fillStyle =
              this.world.ground[y][x] === "water"
                ? "#79b6ac"
                : this.world.ground[y][x] === "path"
                  ? "#dabb87"
                  : this.world.blocked[y][x]
                    ? "#53764d"
                    : "#a3bf80";
            ctx.fillRect(
              Math.floor(x * sx),
              Math.floor(y * sy),
              Math.ceil(sx),
              Math.ceil(sy),
            );
          }
        ctx.fillStyle = "#bd7961";
        ctx.fillRect(5 * sx, 12 * sy, 7 * sx, 4 * sy);
        ctx.fillStyle = "#728b9b";
        ctx.fillRect(27 * sx, 13 * sy, 6 * sx, 4 * sy);
        ctx.fillRect(7 * sx, 4 * sy, 6 * sx, 4 * sy);
        ctx.fillStyle = "#e2b073";
        ctx.fillRect(23 * sx, 5 * sy, 7 * sx, 4 * sy);
        const target =
          window.RPG_WORLD.POSITIONS[this.state.stage === 0 ? "marta" : "mina"];
        if (this.state.stage < 2) {
          ctx.fillStyle = "#fff5b0";
          ctx.beginPath();
          ctx.arc(
            (target.x / 32) * sx,
            (target.y / 32) * sy,
            canvas.width > 100 ? 7 : 2.7,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        const p = this.world.player || window.RPG_WORLD.POSITIONS.start;
        ctx.fillStyle = "#c74f3a";
        ctx.beginPath();
        ctx.arc(
          (p.x / 32) * sx,
          (p.y / 32) * sy,
          canvas.width > 100 ? 6 : 2.2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.strokeStyle = "#fff5dd";
        ctx.lineWidth = canvas.width > 100 ? 2 : 1;
        ctx.stroke();
        if (canvas.width > 100) {
          ctx.font = "12px Malgun Gothic, sans-serif";
          ctx.fillStyle = "#334739";
          ctx.textAlign = "center";
          ctx.fillText("미나의 꽃밭", 27 * sx, 4 * sy);
          ctx.fillText("마르타의 빵집", 8.5 * sx, 11 * sy);
          ctx.fillText("분수", 18.5 * sx, 14 * sy);
          ctx.fillText("잡화점", 30 * sx, 12 * sy);
        }
      }
    }
  }
  // Scene creation is asynchronous, so the shared controller exists before create().
  window.RPG_APP = new Morning();
})();
