import * as THREE from "three";

const TAU = Math.PI * 2;
// Page turning belongs to reading: separate actions must have separate silhouettes.
export const VISITOR_ACTIONS = ["walk", "carry", "browse", "reach", "read", "write", "chat", "photograph", "sit"] as const;
type Action = typeof VISITOR_ACTIONS[number];
type Shape = "box" | "round" | "limb" | "hair" | "shadow";
type Point = [number, number, number];
type Part = { node: THREE.Object3D; shape: Shape; index: number };
type Arm = { pivot: THREE.Group; hand: THREE.Group; length: number };
type Leg = { upper: THREE.Group; lower: THREE.Group };
type Visitor = {
  model: THREE.Group; body: THREE.Group; head: THREE.Group;
  leftArm: Arm; rightArm: Arm; leftLeg: Leg; rightLeg: Leg;
  book: THREE.Group; leaf: THREE.Group; board: THREE.Group; camera: THREE.Group;
  action: Action; angle: number; radius: number; phase: number; variant: number;
};
const SHIRTS = ["#c07450", "#496f73", "#c1a04e", "#688878", "#ece6d5", "#8c6872", "#6b7d99"];
const SKIN = ["#e5bc97", "#c99672", "#efcfaa", "#aa795a"];
const HAIR = ["#44382e", "#5d4533", "#c7bca9", "#282e2d", "#ac8554"];
const TROUSERS = ["#475562", "#776c58", "#53665d", "#454744"];
const DOWN = new THREE.Vector3(0, -1, 0);
const smooth = (a: number, b: number, value: number) => THREE.MathUtils.smoothstep(value, a, b);
// Prepare, gesture, hold, release, rest. Deliberate holds read better than constant swaying.
const gesture = (time: number, period: number) => {
  const p = ((time % period) + period) % period / period;
  return smooth(.12, .28, p) * (1 - smooth(.60, .78, p));
};

/** Original miniature people, rendered in five batches rather than individual meshes. */
export class RingVisitors {
  readonly group = new THREE.Group();
  readonly count = 25;
  private visitors: Visitor[] = [];
  private parts: Part[] = [];
  private batches: Record<Shape, THREE.InstancedMesh>;
  private indices: Record<Shape, number> = { box: 0, round: 0, limb: 0, hair: 0, shadow: 0 };
  private colors: Record<Shape, THREE.Color[]> = { box: [], round: [], limb: [], hair: [], shadow: [] };
  private target = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private shoulder = new THREE.Vector3();

  constructor() {
    const surface = new THREE.MeshStandardMaterial({ roughness: .95, flatShading: true });
    this.batches = {
      box: new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), surface, 350),
      round: new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), surface, 140),
      limb: new THREE.InstancedMesh(new THREE.CylinderGeometry(1, .88, 1, 6), surface, 300),
      hair: new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 5, 0, TAU, 0, Math.PI * .58), surface, this.count),
      shadow: new THREE.InstancedMesh(new THREE.CircleGeometry(1, 16),
        new THREE.MeshBasicMaterial({ color: "#364b39", transparent: true, opacity: .13, depthWrite: false }), this.count),
    };
    const stations = [.10, .49, .88, 1.99, 2.38, 2.77, 3.16, 3.55, 3.94, 5.05, 5.44, 5.83];
    const staticActions: Action[] = ["reach", "read", "browse", "write", "photograph", "sit"];
    const additions: { action: Action; angle: number }[] = [
      { action: "read", angle: 1.13 }, { action: "browse", angle: 4.22 }, { action: "sit", angle: 6.18 },
    ];
    for (let i = 0; i < this.count; i++) {
      const addition = additions[i - 22];
      const action: Action = addition?.action ?? (i < 6 ? (i % 2 ? "carry" : "walk") : i < 18 ? staticActions[(i - 6) % 6] : "chat");
      const angle = addition?.angle ?? (i < 6 ? (i + .4) / 6 * TAU : i < 18 ? stations[i - 6]
        : (i < 20 ? 1.47 : 4.61) + (i % 2 ? .068 : -.068));
      const radius = i < 6 ? 4.03 + (i % 2) * .15 : action === "browse" || action === "reach" ? 4.94 : 4.82;
      this.visitors.push(this.makeVisitor(i, action, angle, radius));
    }
    for (const shape of Object.keys(this.batches) as Shape[]) {
      const batch = this.batches[shape];
      batch.count = this.indices[shape];
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      batch.frustumCulled = false;
      // Moving contact shadows avoid rerendering thousands of stationary paper shadows.
      batch.castShadow = false;
      this.colors[shape].forEach((color, index) => batch.setColorAt(index, color));
      this.group.add(batch);
    }
    this.update(0);
  }

  private part(shape: Shape, parent: THREE.Object3D, position: Point, scale: Point, color: string, rotation?: Point) {
    const node = new THREE.Object3D();
    node.position.set(...position); node.scale.set(...scale);
    if (rotation) node.rotation.set(...rotation);
    parent.add(node);
    const index = this.indices[shape]++;
    this.parts.push({ node, shape, index });
    this.colors[shape][index] = new THREE.Color(color);
    return node;
  }

  private pivot(parent: THREE.Object3D, position: Point) {
    const joint = new THREE.Group();
    joint.position.set(...position); parent.add(joint);
    return joint;
  }

  private arm(parent: THREE.Object3D, side: number, shirt: string, skin: string, stationary: boolean): Arm {
    const length = stationary ? .20 : .16;
    const pivot = this.pivot(parent, [side * .112, .207, 0]);
    // One rigid arm, rotated only at the shoulder. No elbow or length animation.
    this.part("limb", pivot, [0, -length / 2, 0], [.034, length, .034], shirt);
    const hand = this.pivot(pivot, [0, -length, 0]);
    this.part("round", hand, [0, 0, 0], [.032, .037, .029], skin);
    return { pivot, hand, length };
  }

  private leg(parent: THREE.Object3D, side: number, trousers: string): Leg {
    const upper = this.pivot(parent, [side * .05, .289, 0]);
    this.part("limb", upper, [0, -.067, 0], [.041, .134, .044], trousers);
    const lower = this.pivot(upper, [0, -.134, 0]);
    this.part("limb", lower, [0, -.061, 0], [.031, .122, .033], trousers);
    this.part("box", lower, [0, -.122, .023], [.075, .041, .13], "#ede8dc");
    return { upper, lower };
  }

  private makeVisitor(index: number, action: Action, angle: number, radius: number): Visitor {
    const model = new THREE.Group();
    const stationary = action !== "walk" && action !== "carry";
    model.scale.setScalar((stationary ? 1.34 : 1.12) + (index % 3) * .035);
    const shirt = SHIRTS[index % SHIRTS.length], skin = SKIN[index % SKIN.length];
    const body = this.pivot(model, [0, .29, 0]);
    this.part("limb", body, [0, .111, 0], [.099, .228, .069], shirt);
    this.part("limb", body, [0, .246, 0], [.034, .047, .033], skin);
    const head = this.pivot(body, [0, .263, 0]);
    this.part("round", head, [0, .055, 0], [.071, .083, .067], skin);
    this.part("hair", head, [0, .06, -.008], [.076, .086, .07], HAIR[index % HAIR.length]);
    this.part("round", head, [0, .043, .06], [.022, .021, .028], skin);
    const leftArm = this.arm(body, -1, shirt, skin, stationary), rightArm = this.arm(body, 1, shirt, skin, stationary);
    const leftLeg = this.leg(model, -1, TROUSERS[index % 4]), rightLeg = this.leg(model, 1, TROUSERS[index % 4]);
    // Keep both grips at the end of the shorter, rigid arms.
    const bookDepth = Math.sqrt(leftArm.length ** 2 - .033 ** 2 - (.085 + .035 * Math.cos(.26) - .207) ** 2) - .035 * Math.sin(.26);
    const book = this.pivot(body, [0, .085, bookDepth]);
    const leaf = this.pivot(book, [0, .024, 0]);
    if (action === "read") {
      this.part("box", book, [0, 0, 0], [.32, .026, .215], "#52685c");
      for (const side of [-1, 1]) {
        this.part("box", book, [side * .077, .02, 0], [.145, .014, .20], "#fffdf0");
        for (let row = 0; row < 3; row++) this.part("box", book, [side * .077, .029, -.045 + row * .038], [.10, .002, .009], "#a6a498");
      }
      this.part("box", leaf, [.077, 0, 0], [.15, .006, .198], "#fffef5");
      book.rotation.set(.26, 0, 0);
    }
    const board = this.pivot(model, [0, .35, .29]);
    if (action === "write") {
      this.part("box", model, [0, .33, .29], [.40, .032, .29], "#9ba78b");
      for (const x of [-.14, .14]) this.part("limb", model, [x, .158, .29], [.025, .316, .06], "#7d8c79");
      this.part("box", board, [0, 0, 0], [.265, .01, .23], "#fffdf0");
      for (let row = 0; row < 4; row++) this.part("box", board, [0, .006, -.07 + row * .037], [.19, .002, .009], "#9fa398");
      this.part("box", rightArm.hand, [0, -.01, .034], [.012, .13, .012], "#354d58", [.5, 0, .3]);
    }
    const camera = this.pivot(body, [0, .28, .23]);
    if (action === "photograph") {
      this.part("box", camera, [0, 0, 0], [.18, .11, .085], "#293b39");
      this.part("limb", camera, [.025, 0, .06], [.044, .055, .044], "#697f79", [Math.PI / 2, 0, 0]);
    }
    if (action === "carry") {
      this.part("box", model, [.16, .285, .028], [.04, .21, .16], "#bc965e");
      this.part("box", model, [.16, .296, .036], [.046, .182, .143], "#eee8d8");
    }
    if (action === "reach") {
      // The document stays attached to the raised hand through the entire motion.
      const sheet = this.pivot(rightArm.hand, [0, -.06, .035]);
      this.part("box", sheet, [0, 0, 0], [.205, .175, .018], "#9c7b54");
      this.part("box", sheet, [0, 0, .012], [.182, .15, .004], "#fffcef");
    }
    if (action === "browse") {
      this.part("box", model, [0, .041, .28], [.34, .082, .23], "#aaa080");
      for (let i = 0; i < 3; i++) this.part("box", model, [i * .036 - .03, .088 + i * .019, .28], [.22, .017, .19], i % 2 ? "#b8c1a8" : "#f1e8ce", [0, i * .18, 0]);
    }
    if (action === "sit") {
      this.part("box", model, [0, .172, -.035], [.34, .042, .30], "#748c77");
      this.part("box", model, [0, .31, -.16], [.34, .235, .033], "#748c77");
      for (const x of [-.12, .12]) for (const z of [-.12, .06]) this.part("limb", model, [x, .077, z], [.019, .154, .019], "#7e8873");
    }
    this.part("shadow", model, [0, .008, .015], [stationary ? .18 : .15, .115, 1], "#ffffff", [-Math.PI / 2, 0, 0]);
    return { model, body, head, leftArm, rightArm, leftLeg, rightLeg, book, leaf, board, camera,
      action, angle, radius, phase: index * 2.39996, variant: index % 2 };
  }

  /** Aim the whole arm from its shoulder; its shape and length stay constant. */
  private hold(v: Visitor, arm: Arm, parent: THREE.Object3D, point: Point) {
    this.target.set(...point).applyMatrix4(parent.matrixWorld);
    v.body.worldToLocal(this.target);
    this.direction.copy(this.target).sub(arm.pivot.position).normalize();
    arm.pivot.quaternion.setFromUnitVectors(DOWN, this.direction);
  }

  private holdOnSurface(v: Visitor, arm: Arm, x: number, y: number) {
    this.shoulder.copy(arm.pivot.position).applyMatrix4(v.body.matrix);
    const dx = x - this.shoulder.x, dy = y - this.shoulder.y;
    const z = this.shoulder.z + Math.sqrt(Math.max(0, arm.length ** 2 - dx ** 2 - dy ** 2));
    this.hold(v, arm, v.model, [x, y, z]);
  }

  update(time: number) {
    for (const v of this.visitors) {
      const t = time + v.phase;
      const breath = Math.sin(t * 1.5) * .004;
      const walking = v.action === "walk" || v.action === "carry";
      const beat = gesture(t, 8.5);
      const angle = v.angle + (walking ? Math.sin(t * .052) * .36 : 0);
      v.model.position.set(Math.sin(angle) * v.radius, .008, Math.cos(angle) * v.radius);
      v.model.rotation.y = angle + (walking ? (Math.cos(t * .052) >= 0 ? Math.PI / 2 : -Math.PI / 2)
        : ["browse", "reach", "photograph"].includes(v.action) ? .24 : Math.PI + .3);
      v.body.position.set(0, .29 + breath, 0);
      v.body.rotation.set(0, 0, 0);
      v.head.rotation.set(.06, Math.sin(t * .45) * .1, 0);
      for (const limb of [v.leftLeg, v.rightLeg]) {
        limb.upper.rotation.set(0, 0, 0); limb.lower.rotation.set(0, 0, 0);
      }
      v.leftArm.pivot.rotation.set(0, 0, -.08); v.rightArm.pivot.rotation.set(0, 0, .08);
      v.leftLeg.upper.position.set(-.05, .289, 0); v.rightLeg.upper.position.set(.05, .289, 0);
      if (walking) {
        const stride = Math.sin(t * 5.2) * .31 * Math.abs(Math.cos(t * .052));
        v.leftLeg.upper.rotation.x = stride; v.rightLeg.upper.rotation.x = -stride;
        v.leftLeg.lower.rotation.x = Math.max(0, -stride) * .7;
        v.rightLeg.lower.rotation.x = Math.max(0, stride) * .7;
        v.leftArm.pivot.rotation.x = -stride * .8;
        v.rightArm.pivot.rotation.x = v.action === "carry" ? -.2 : stride * .8;
        v.body.position.y += Math.abs(Math.sin(t * 5.2)) * .008;
      } else if (v.action === "browse") {
        // A low crouch and a broad sideways sorting motion, not another standing reader.
        v.body.position.y = .15 + breath;
        v.body.rotation.x = .48 + beat * .12;
        v.head.rotation.x = .25;
        for (const leg of [v.leftLeg, v.rightLeg]) {
          leg.upper.position.y = .15;
          leg.upper.rotation.x = -1.08; leg.lower.rotation.x = 2.10;
        }
        v.leftLeg.upper.position.x = -.08; v.rightLeg.upper.position.x = .08;
      } else if (v.action === "reach") {
        v.rightArm.pivot.rotation.set(-1.35 - beat * 1.35, 0, .35);
        v.leftArm.pivot.rotation.set(.1, 0, -.1);
        v.body.rotation.z = .10 + beat * .10;
        v.head.rotation.x = -.2 - beat * .24;
        v.leftLeg.upper.position.x = -.075; v.rightLeg.upper.position.x = .075;
      } else if (v.action === "read") {
        v.head.rotation.x = .37;
        v.body.rotation.y = -.12;
        v.leaf.rotation.z = gesture(t, 10) * 2.85;
      } else if (v.action === "write") {
        v.body.rotation.x = .43;
        v.head.rotation.x = .35;
        v.body.rotation.y = -.10;
      } else if (v.action === "sit") {
        v.body.position.set(0, .184 + breath, -.035);
        v.body.rotation.x = -.25;
        v.head.rotation.set(-.1, .3, -.12);
        for (const leg of [v.leftLeg, v.rightLeg]) {
          leg.upper.position.y = .184;
          leg.upper.rotation.x = -1.35; leg.lower.rotation.x = 1.35;
        }
        // Leaning back with an extended foot and an arm on the chair back.
        v.rightLeg.upper.rotation.x = -1.65;
        v.rightLeg.lower.rotation.x = .9 + Math.sin(t * 1.8) * .16;
        v.leftArm.pivot.rotation.set(-.3, 0, -1.25);
        v.rightArm.pivot.rotation.set(-.9, 0, .25);
      } else if (v.action === "chat") {
        // Two actual pairs: an open-arm speaker and a relaxed listener.
        v.model.rotation.y = angle + (v.variant ? -Math.PI / 2 : Math.PI / 2);
        v.body.rotation.y = v.variant ? -.12 : .18;
        v.head.rotation.x = v.variant ? Math.sin(t * 1.5) * .16 : -.08;
        if (!v.variant) {
          v.rightArm.pivot.rotation.set(-1.0, 0, .60 + beat * .45);
          v.leftArm.pivot.rotation.set(-.9, 0, -.4);
        } else {
          v.rightArm.pivot.rotation.set(.08, 0, -.2);
          v.leftArm.pivot.rotation.set(-.3, 0, -.22);
        }
      } else if (v.action === "photograph") {
        const lift = gesture(t, 9.5);
        const y = .075 + lift * .24;
        const z = Math.sqrt(v.leftArm.length ** 2 - .012 ** 2 - (y - .012 - .207) ** 2);
        v.camera.position.set(0, y, z);
        v.head.rotation.set(.15 - lift * .25, 0, 0);
        v.body.rotation.y = .10;
        v.leftLeg.upper.position.x = -.075; v.rightLeg.upper.position.x = .075;
      }
      v.model.updateMatrixWorld(true);
      if (v.action === "read") {
        this.hold(v, v.leftArm, v.book, [-.145, .035, 0]);
        this.hold(v, v.rightArm, v.book, [.145, .035, 0]);
      } else if (v.action === "write") {
        this.holdOnSurface(v, v.leftArm, -.12, v.board.position.y + .025);
        const stroke = Math.sin(t * 3.4) * .045 * gesture(t, 7);
        this.holdOnSurface(v, v.rightArm, .06 + stroke, v.board.position.y + .06);
      } else if (v.action === "photograph") {
        this.hold(v, v.leftArm, v.camera, [-.1, -.012, 0]);
        this.hold(v, v.rightArm, v.camera, [.1, -.012, 0]);
      } else if (v.action === "browse") {
        this.holdOnSurface(v, v.leftArm, -.14, .15);
        this.holdOnSurface(v, v.rightArm, .13 - beat * .13, .155 + beat * .025);
      }
      v.model.updateMatrixWorld(true);
    }
    for (const { node, shape, index } of this.parts) this.batches[shape].setMatrixAt(index, node.matrixWorld);
    for (const batch of Object.values(this.batches)) batch.instanceMatrix.needsUpdate = true;
  }
}
