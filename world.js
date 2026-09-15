(() => {
  const TILE = 32,
    COLS = 40,
    ROWS = 30;
  const POSITIONS = {
    start: { x: 8.5 * TILE, y: 19.5 * TILE },
    marta: {
      x: 10.5 * TILE,
      y: 18.5 * TILE,
      frame: 86,
      name: "마르타",
      label: "빵집 주인",
    },
    mina: {
      x: 27.5 * TILE,
      y: 7.5 * TILE,
      frame: 99,
      name: "미나",
      label: "꽃밭의 소녀",
    },
    owen: {
      x: 22.5 * TILE,
      y: 9.5 * TILE,
      frame: 100,
      name: "오웬",
      label: "정원사",
    },
    well: {
      x: 18.5 * TILE,
      y: 16.5 * TILE,
      name: "마을 분수",
      label: "살펴보기",
    },
    cat: {
      x: 13.5 * TILE,
      y: 21.5 * TILE,
      name: "낮잠 고양이",
      label: "말 걸기",
    },
    sign: {
      x: 20.5 * TILE,
      y: 23.5 * TILE,
      name: "마을 안내판",
      label: "읽어 보기",
    },
    bag: {
      x: 7.5 * TILE,
      y: 18.5 * TILE,
      name: "루카의 자루",
      label: "살펴보기",
    },
    chest: {
      x: 32.5 * TILE,
      y: 22.5 * TILE,
      name: "낡은 상자",
      label: "열어 보기",
    },
  };
  const rand = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  class Village extends Phaser.Scene {
    constructor() {
      super("Village");
      this.walkTarget = null;
      this.route = [];
      this.walkPhase = 0;
      this.stepAt = 0;
      this.nearestId = null;
    }
    preload() {
      this.load.spritesheet(
        "town",
        "assets/kenney-tiny-town/Tilemap/tilemap_packed.png",
        { frameWidth: 16, frameHeight: 16 },
      );
      this.load.spritesheet(
        "people",
        "assets/kenney-tiny-dungeon/Tilemap/tilemap_packed.png",
        { frameWidth: 16, frameHeight: 16 },
      );
      this.load.on("loaderror", () => window.RPG_APP?.loadError());
    }
    create() {
      this.blocked = Array.from({ length: ROWS }, () =>
        Array(COLS).fill(false),
      );
      this.ground = Array.from({ length: ROWS }, () =>
        Array(COLS).fill("grass"),
      );
      this.npcs = {};
      this.bits = [];
      this.animations = [];
      this.makeGround();
      this.makeTown();
      this.makePeople();
      this.makeAtmosphere();
      const p = POSITIONS.start;
      this.player = { x: p.x, y: p.y };
      this.shadow = this.add
        .ellipse(p.x, p.y + 4, 24, 9, 0x314935, 0.23)
        .setDepth(p.y - 2);
      this.hero = this.add
        .sprite(p.x, p.y, "people", 98)
        .setScale(2.5)
        .setOrigin(0.5, 0.83)
        .setDepth(p.y);
      this.heroMark = this.add
        .text(p.x, p.y - 47, "루카", {
          fontFamily: "Malgun Gothic, sans-serif",
          fontSize: "10px",
          color: "#fff9d8",
          stroke: "#456148",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(2000);
      this.questMark = this.add
        .text(0, 0, "!", {
          fontFamily: "Georgia, serif",
          fontSize: "26px",
          fontStyle: "bold",
          color: "#fff5a6",
          stroke: "#866d32",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 1)
        .setDepth(2001);
      this.destination = this.add.graphics().setDepth(1900).setVisible(false);
      this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
      this.cameras.main.setRoundPixels(true);
      this.cameras.main.centerOn(16 * TILE, 15 * TILE);
      this.input.on("pointerup", (pointer) => {
        if (!window.RPG_APP?.canMove()) return;
        if (pointer.getDistance() > 15) return;
        const wp = pointer.positionToCamera(this.cameras.main);
        let closest = null,
          distance = 48;
        for (const [id, npc] of Object.entries(POSITIONS)) {
          if (id === "start") continue;
          const d = Phaser.Math.Distance.Between(wp.x, wp.y, npc.x, npc.y);
          if (d < distance) {
            closest = id;
            distance = d;
          }
        }
        this.navigate(wp.x, wp.y, closest);
      });
      this.scale.on("resize", () => {
        if (window.RPG_APP?.started) this.centerPlayer();
        else this.cameras.main.centerOn(16 * TILE, 15 * TILE);
      });
      this.ready = true;
      window.RPG_APP?.onWorldReady(this);
    }
    tile(frame, x, y, depth = 0) {
      return this.add
        .image(x * TILE, y * TILE, "town", frame)
        .setOrigin(0)
        .setScale(2)
        .setDepth(depth);
    }
    markBlocked(x, y, w = 1, h = 1) {
      for (let row = y; row < y + h; row++)
        for (let col = x; col < x + w; col++)
          if (this.blocked[row]?.[col] !== undefined)
            this.blocked[row][col] = true;
    }
    makeGround() {
      const path = (x, y, w, h) => {
        for (let j = y; j < y + h; j++)
          for (let i = x; i < x + w; i++) this.ground[j][i] = "path";
      };
      path(3, 19, 34, 3);
      path(17, 4, 3, 23);
      path(17, 7, 16, 3);
      path(8, 16, 4, 6);
      path(27, 8, 3, 13);
      path(16, 14, 7, 6);
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++) {
          const r = rand(x, y);
          let frame = r > 0.85 ? 1 : 0;
          if (this.ground[y][x] === "path") {
            const top = this.ground[y - 1]?.[x] !== "path",
              bottom = this.ground[y + 1]?.[x] !== "path",
              left = this.ground[y]?.[x - 1] !== "path",
              right = this.ground[y]?.[x + 1] !== "path";
            frame = top
              ? left
                ? 12
                : right
                  ? 14
                  : 13
              : bottom
                ? left
                  ? 36
                  : right
                    ? 38
                    : 37
                : left
                  ? 24
                  : right
                    ? 26
                    : 25;
          }
          this.tile(frame, x, y);
          if (this.ground[y][x] === "grass" && r > 0.975) this.tile(2, x, y, 1);
          if (this.ground[y][x] === "grass" && r < 0.017)
            this.tile(17, x, y, 1);
          if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1)
            this.markBlocked(x, y);
        }
    }
    house(x, y, width = 6, blue = false, label = "") {
      this.add
        .rectangle(
          (x + width / 2) * TILE + 6,
          (y + 2) * TILE + 12,
          width * TILE,
          3 * TILE,
          0x31482f,
          0.16,
        )
        .setOrigin(0.5, 0)
        .setDepth(1);
      const top = blue ? [48, 49, 50] : [52, 53, 54],
        low = blue ? [60, 61, 62] : [64, 65, 66];
      for (let col = 0; col < width; col++) {
        this.tile(
          col === 0 ? top[0] : col === width - 1 ? top[2] : top[1],
          x + col,
          y,
          (y + 4) * TILE,
        );
        this.tile(
          col === 0
            ? low[0]
            : col === width - 1
              ? low[2]
              : col === Math.floor(width / 2)
                ? blue
                  ? 63
                  : 67
                : low[1],
          x + col,
          y + 1,
          (y + 4) * TILE,
        );
        this.tile(
          col === 0 ? 72 : col === width - 1 ? 75 : 73,
          x + col,
          y + 2,
          (y + 4) * TILE,
        );
        this.tile(
          col === Math.floor(width / 2)
            ? 85
            : col === 1 || col === width - 2
              ? 84
              : col === 0
                ? 72
                : col === width - 1
                  ? 75
                  : 73,
          x + col,
          y + 3,
          (y + 4) * TILE,
        );
      }
      this.markBlocked(x, y, width, 4);
      if (label)
        this.add
          .text((x + width / 2) * TILE, (y + 2.4) * TILE, label, {
            fontFamily: "Malgun Gothic, sans-serif",
            fontSize: "10px",
            color: "#faf0d8",
            backgroundColor: "#755c49",
            padding: { x: 8, y: 4 },
          })
          .setOrigin(0.5)
          .setDepth((y + 4) * TILE + 1);
    }
    tree(x, y, autumn = false) {
      // A standalone tree is two vertical tiles. The atlas's 3x3 groups
      // are forest edge pieces and do not form a single connected tree.
      const frames = autumn ? [3, 15] : [4, 16];
      const centerX = (x + 1.5) * TILE;
      const baseY = (y + 3) * TILE - 4;
      this.add
        .ellipse(centerX, baseY, 40, 12, 0x39552e, 0.16)
        .setDepth(1);
      frames.forEach((frame, row) => {
        this.add
          .image(centerX, y * TILE + row * 48, "town", frame)
          .setOrigin(0.5, 0)
          .setScale(3)
          .setDepth(baseY);
      });
      this.markBlocked(x + 1, y + 1, 1, 2);
    }
    fence(x, y, w) {
      for (let col = 0; col < w; col++) {
        this.tile(
          col === 0 ? 80 : col === w - 1 ? 82 : 81,
          x + col,
          y,
          y * TILE + 24,
        );
        this.markBlocked(x + col, y);
      }
    }
    makeTown() {
      this.house(5, 12, 7, false, "마르타의 빵집");
      // Canvas-native striped awning, resting sack and bakery stall.
      const awning = this.add.graphics().setDepth(16 * TILE + 2);
      awning.fillStyle(0x745444);
      awning.fillRect(5 * TILE, 16 * TILE, 7 * TILE, 8);
      for (let i = 0; i < 14; i++) {
        awning.fillStyle(i % 2 ? 0xf1db9c : 0xd37e5c);
        awning.fillRect(5 * TILE + i * 16, 16 * TILE - 6, 16, 18);
        awning.fillRect(5 * TILE + i * 16, 16 * TILE + 12, 16, 5);
      }
      this.tile(107, 5, 17, 17 * TILE + 20);
      this.tile(106, 6, 17, 17 * TILE + 20);
      this.tile(130, 7, 18, 18 * TILE + 20);
      this.tile(106, 6, 18, 18 * TILE + 18);
      this.house(27, 13, 6, true, "잡화점");
      this.tile(57, 33, 18, 18 * TILE + 25);
      this.markBlocked(33, 18);
      this.house(7, 4, 6, true, "");
      this.fence(7, 9, 4);
      this.house(30, 3, 5, false, "");
      this.fence(21, 4, 8);
      this.fence(30, 11, 5);
      this.fence(6, 24, 7);
      this.fence(26, 25, 8);
      for (let y = 5; y < 9; y++)
        for (let x = 23; x < 30; x++)
          if (x !== 27) {
            this.tile(25, x, y, 0);
            const flower = this.add.graphics().setDepth(y * TILE + 8),
              c =
                (x + y) % 3 === 0
                  ? 0xf9d878
                  : (x + y) % 3 === 1
                    ? 0xf4eee3
                    : 0xf39b8d;
            flower.fillStyle(0x658951);
            flower.fillRect(x * TILE + 15, y * TILE + 16, 3, 10);
            flower.fillStyle(c);
            flower.fillRect(x * TILE + 9, y * TILE + 8, 15, 12);
            flower.fillRect(x * TILE + 12, y * TILE + 5, 9, 18);
            flower.fillStyle(0xd4a451);
            flower.fillRect(x * TILE + 15, y * TILE + 11, 3, 5);
          }
      this.tile(131, 21, 7, 7 * TILE + 20);
      this.tile(116, 21, 10, 10 * TILE + 22);
      this.makeFountain();
      // Brook at the eastern edge, with lily pads and soft animated glints.
      const river = this.add.graphics().setDepth(1);
      river.fillStyle(0x769f89);
      river.fillRect(36 * TILE, 3 * TILE, 3 * TILE, 24 * TILE);
      river.fillStyle(0x80c5b9);
      river.fillRect(36 * TILE + 7, 3 * TILE, 3 * TILE - 14, 24 * TILE);
      for (let y = 3; y < 27; y++)
        for (let x = 36; x < 39; x++) {
          this.markBlocked(x, y);
          this.ground[y][x] = "water";
          if ((x + y) % 4 === 0) {
            const line = this.add
              .rectangle(x * TILE + 18, y * TILE + 16, 18, 2, 0xc7e5c0, 0.5)
              .setDepth(2);
            this.animations.push({ object: line, x: line.x, phase: y });
          }
        }
      for (const [x, y, a] of [
        [1, 1],
        [4, 0],
        [13, 1],
        [20, 0],
        [25, 0],
        [35, 0],
        [0, 8],
        [1, 13],
        [1, 23],
        [4, 27],
        [12, 26],
        [21, 27],
        [29, 27],
        [34, 23],
        [34, 10],
        [13, 10],
        [22, 22],
      ])
        this.tree(x, y, a);
      for (let x = 1; x < 36; x += 3) {
        if (x < 15 || x > 21) this.tree(x, 28, x % 2 === 0);
      }
      for (const [x, y] of [
        [4, 10],
        [14, 7],
        [14, 25],
        [25, 12],
        [32, 12],
        [34, 19],
        [21, 12],
        [3, 5],
        [30, 24],
      ]) {
        this.tile(5, x, y, y * TILE + 21);
        this.markBlocked(x, y);
      }
      this.tile(83, 20, 23, 23 * TILE + 25);
      this.add
        .sprite(POSITIONS.chest.x, POSITIONS.chest.y, "people", 89)
        .setScale(2)
        .setOrigin(0.5, 0.8)
        .setDepth(POSITIONS.chest.y);
      const cat = this.add.graphics().setDepth(POSITIONS.cat.y),
        cx = POSITIONS.cat.x,
        cy = POSITIONS.cat.y;
      cat.fillStyle(0x593d38);
      cat.fillRect(cx - 12, cy - 9, 25, 13);
      cat.fillRect(cx - 14, cy - 14, 7, 9);
      cat.fillRect(cx + 7, cy - 14, 7, 9);
      cat.fillRect(cx + 12, cy - 3, 10, 5);
      cat.fillStyle(0xebc990);
      cat.fillRect(cx - 9, cy - 7, 19, 9);
      cat.fillStyle(0x493e3b);
      cat.fillRect(cx - 5, cy - 4, 3, 2);
      cat.fillRect(cx + 4, cy - 4, 3, 2);
    }
    makeFountain() {
      const { x, y } = POSITIONS.well;
      const g = this.add.graphics().setDepth(y + 5);
      g.fillStyle(0x466d60, 0.16);
      g.fillEllipse(x + 7, y + 15, 84, 35);
      g.fillStyle(0x666f66);
      g.fillRoundedRect(x - 33, y - 23, 66, 50, 10);
      g.fillStyle(0xc5c8b6);
      g.fillRoundedRect(x - 33, y - 28, 66, 43, 10);
      g.fillStyle(0x769b92);
      g.fillEllipse(x, y - 8, 52, 26);
      g.fillStyle(0x9fd4c6);
      g.fillEllipse(x, y - 12, 47, 20);
      g.fillStyle(0x87988e);
      g.fillRect(x - 5, y - 35, 10, 24);
      g.fillStyle(0xd3d8c3);
      g.fillEllipse(x, y - 35, 27, 9);
      const water = this.add.graphics().setDepth(y + 6);
      water.lineStyle(2, 0xd5f1d5, 0.8);
      water.beginPath();
      water.moveTo(x - 11, y - 29);
      water.lineTo(x - 17, y - 12);
      water.moveTo(x + 11, y - 29);
      water.lineTo(x + 17, y - 12);
      water.strokePath();
      this.markBlocked(17, 15, 3, 3);
    }
    makePeople() {
      for (const id of ["marta", "mina", "owen"]) {
        const p = POSITIONS[id];
        const shadow = this.add
          .ellipse(p.x, p.y + 4, 24, 8, 0x334b35, 0.2)
          .setDepth(p.y - 1);
        const sprite = this.add
          .sprite(p.x, p.y, "people", p.frame)
          .setOrigin(0.5, 0.83)
          .setScale(2.5)
          .setDepth(p.y);
        const label = this.add
          .text(p.x, p.y - 40, p.name, {
            fontFamily: "Malgun Gothic, sans-serif",
            fontSize: "10px",
            color: "#fffbe8",
            stroke: "#57724d",
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(p.y + 1);
        this.npcs[id] = { sprite, shadow, label };
      }
      // A passer-by makes the village feel awake without interrupting the errand.
      this.passer = this.add
        .sprite(24 * TILE, 20.5 * TILE, "people", 85)
        .setOrigin(0.5, 0.83)
        .setScale(2.2)
        .setDepth(20.5 * TILE);
    }
    makeAtmosphere() {
      this.specks = [];
      for (let i = 0; i < 22; i++)
        this.specks.push(
          this.add
            .rectangle(
              rand(i, 42) * COLS * TILE,
              rand(i, 31) * ROWS * TILE,
              3,
              3,
              0xfff3ba,
              0.5,
            )
            .setDepth(1800),
        );
    }
    activate(position) {
      if (
        position &&
        Number.isFinite(position.x) &&
        Number.isFinite(position.y) &&
        this.canStand(position.x, position.y)
      )
        this.player = { x: position.x, y: position.y };
      else this.player = { ...POSITIONS.start };
      this.route = [];
      this.walkTarget = null;
      this.centerPlayer();
      this.syncHero(0);
    }
    centerPlayer() {
      const camera = this.cameras.main;
      const app = window.RPG_APP;
      if (app?.inDialogue && document.documentElement.classList.contains("mobile-ui")) {
        const gameTop = document.getElementById("game").getBoundingClientRect().top;
        const dialogueTop = document.getElementById("dialogue").getBoundingClientRect().top;
        const visibleHeight = Math.max(48, dialogueTop - gameTop);
        camera.centerOn(this.player.x, this.player.y + camera.height / 2 - visibleHeight / 2 - 16);
      } else camera.centerOn(this.player.x, this.player.y - 38);
    }
    canStand(x, y) {
      if (x < 32 || y < 40 || x > COLS * TILE - 32 || y > ROWS * TILE - 32)
        return false;
      for (const dx of [-8, 8])
        for (const dy of [-5, 5])
          if (
            this.blocked[Math.floor((y + dy) / TILE)]?.[
              Math.floor((x + dx) / TILE)
            ] !== false
          )
            return false;
      return true;
    }
    navigate(x, y, interactId = null) {
      const target = interactId ? POSITIONS[interactId] : { x, y };
      const start = {
        x: Math.floor(this.player.x / TILE),
        y: Math.floor(this.player.y / TILE),
      };
      let goal = {
        x: Phaser.Math.Clamp(Math.floor(target.x / TILE), 1, COLS - 2),
        y: Phaser.Math.Clamp(Math.floor(target.y / TILE), 1, ROWS - 2),
      };
      if (this.blocked[goal.y][goal.x] || interactId) {
        const spots = [];
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            if (interactId && dx === 0 && dy === 0) continue;
            const tx = goal.x + dx,
              ty = goal.y + dy;
            if (
              this.blocked[ty]?.[tx] === false &&
              this.canStand((tx + 0.5) * TILE, (ty + 0.5) * TILE)
            )
              spots.push({
                x: tx,
                y: ty,
                score:
                  Math.hypot(dx, dy) +
                  Math.hypot(tx - start.x, ty - start.y) * 0.025,
              });
          }
        spots.sort((a, b) => a.score - b.score);
        if (!spots.length) return;
        goal = spots[0];
      }
      const key = (p) => p.x + "," + p.y,
        queue = [start],
        came = new Map([[key(start), null]]);
      let found = false;
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i];
        if (p.x === goal.x && p.y === goal.y) {
          found = true;
          break;
        }
        for (const [dx, dy] of [
          [0, -1],
          [-1, 0],
          [1, 0],
          [0, 1],
        ]) {
          const n = { x: p.x + dx, y: p.y + dy };
          if (this.blocked[n.y]?.[n.x] !== false || came.has(key(n))) continue;
          came.set(key(n), p);
          queue.push(n);
        }
      }
      if (!found) return;
      const route = [];
      let current = goal;
      while (current) {
        route.unshift({
          x: (current.x + 0.5) * TILE,
          y: (current.y + 0.5) * TILE,
        });
        current = came.get(key(current));
      }
      // Reach the current cell's center before turning, avoiding clipping corners.
      this.route = route;
      this.walkTarget = interactId;
      this.destination
        .clear()
        .lineStyle(2, 0xfff2b5, 0.9)
        .strokeEllipse((goal.x + 0.5) * TILE, (goal.y + 0.5) * TILE, 24, 12)
        .setVisible(true);
    }
    syncHero(bob) {
      const p = this.player;
      this.hero
        .setPosition(Math.round(p.x), Math.round(p.y + bob))
        .setDepth(p.y);
      this.shadow
        .setPosition(Math.round(p.x), Math.round(p.y + 4))
        .setDepth(p.y - 2);
      this.heroMark.setPosition(Math.round(p.x), Math.round(p.y - 48 + bob));
    }
    update(time, delta) {
      if (!this.ready) return;
      const app = window.RPG_APP,
        dt = Math.min(delta, 45) / 1000;
      let moving = false;
      if (app?.canMove()) {
        let dx = (app.keys.right ? 1 : 0) - (app.keys.left ? 1 : 0),
          dy = (app.keys.down ? 1 : 0) - (app.keys.up ? 1 : 0);
        if (dx || dy) {
          this.route = [];
          this.walkTarget = null;
          this.destination.setVisible(false);
        } else if (this.route.length) {
          const next = this.route[0],
            dist = Math.hypot(next.x - this.player.x, next.y - this.player.y);
          if (dist < 3) {
            this.player.x = next.x;
            this.player.y = next.y;
            this.route.shift();
          } else {
            dx = (next.x - this.player.x) / dist;
            dy = (next.y - this.player.y) / dist;
          }
        }
        if (dx || dy) {
          const len = Math.hypot(dx, dy),
            speed = 126,
            sx = (dx / len) * speed * dt,
            sy = (dy / len) * speed * dt;
          const px = this.player.x,
            py = this.player.y;
          if (this.canStand(px + sx, py)) this.player.x += sx;
          if (this.canStand(this.player.x, py + sy)) this.player.y += sy;
          moving = px !== this.player.x || py !== this.player.y;
          if (dx) this.hero.setFlipX(dx < 0);
          if (!moving && this.route.length) {
            this.route = [];
            this.walkTarget = null;
            this.destination.setVisible(false);
          }
        }
        if (!this.route.length) {
          this.destination.setVisible(false);
          if (this.walkTarget) {
            const id = this.walkTarget;
            this.walkTarget = null;
            if (this.distanceTo(id) < 78) app.interact(id);
          }
        }
        this.centerPlayer();
        let near = null,
          best = 72;
        for (const [id, p] of Object.entries(POSITIONS)) {
          if (id === "start") continue;
          const d = Math.hypot(p.x - this.player.x, p.y - this.player.y);
          if (d < best) {
            best = d;
            near = id;
          }
        }
        if (near !== this.nearestId) {
          this.nearestId = near;
          app.onNearby(near);
        }
        if (moving && time - this.stepAt > 320) {
          this.stepAt = time;
          app.audio.effect("step");
        }
      }
      if (moving) this.walkPhase += dt * 17;
      this.syncHero(
        moving && !app?.state.reducedMotion
          ? Math.sin(this.walkPhase) * 1.8
          : 0,
      );
      this.heroMark.setVisible(!!app?.started && !app?.inDialogue);
      const q = POSITIONS[app?.state.stage === 0 ? "marta" : "mina"];
      this.questMark.setVisible(!!app?.started && app.state.stage < 2);
      this.questMark.setPosition(
        q.x,
        q.y - 45 + (app?.state.reducedMotion ? 0 : Math.sin(time / 330) * 3),
      );
      if (!app?.state.reducedMotion) {
        for (let i = 0; i < this.specks.length; i++) {
          const s = this.specks[i];
          s.x = (s.x + dt * (6 + (i % 4))) % (COLS * TILE);
          s.y += Math.sin(time / 1700 + i) * dt * 3;
          s.alpha = 0.2 + Math.sin(time / 1400 + i) * 0.15;
        }
        for (const a of this.animations)
          a.object.x = a.x + Math.sin(time / 1400 + a.phase) * 4;
        this.passer.x = (24 + Math.sin(time / 10000) * 2) * TILE;
        this.passer.setFlipX(Math.cos(time / 10000) < 0);
      }
      if (time - (this.lastMap || 0) > 150) {
        this.lastMap = time;
        app?.drawMap();
      }
    }
    distanceTo(id) {
      const p = POSITIONS[id];
      return p
        ? Math.hypot(p.x - this.player.x, p.y - this.player.y)
        : Infinity;
    }
  }
  window.RPG_WORLD = { Village, TILE, COLS, ROWS, POSITIONS };
})();
