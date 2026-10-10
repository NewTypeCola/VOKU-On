import * as THREE from "three";

const TAU = Math.PI * 2;
export const VISITOR_ACTIONS = ["walk", "carry", "browse", "reach", "read", "turn-page", "write", "chat", "photograph", "sit"] as const;
type Action = typeof VISITOR_ACTIONS[number];
type Shape = "box" | "round" | "limb" | "hair" | "shadow";
type Point = [number, number, number];
type Part = { node: THREE.Object3D; shape: Shape; index: number };
type Arm = { upper: THREE.Group; lower: THREE.Group };
type Visitor = {
  model: THREE.Group; body: THREE.Group; head: THREE.Group;
  leftArm: Arm; rightArm: Arm; leftLeg: Arm; rightLeg: Arm;
  book: THREE.Group; leaf: THREE.Group; board: THREE.Group;
  camera: THREE.Group; folder: THREE.Group;
  action: Action; angle: number; radius: number; phase: number;
};
const SHIRTS = ["#c07450", "#496f73", "#c1a04e", "#688878", "#ece6d5", "#8c6872", "#6b7d99"];
const SKIN = ["#e5bc97", "#c99672", "#efcfaa", "#aa795a"];
const HAIR = ["#44382e", "#5d4533", "#c7bca9", "#282e2d", "#ac8554"];
const TROUSERS = ["#475562", "#776c58", "#53665d", "#454744"];

/** Original miniature people, rendered in five batches rather than hundreds of meshes. */
export class RingVisitors {
  readonly group = new THREE.Group();
  readonly count = 30;
  private visitors: Visitor[] = [];
  private parts: Part[] = [];
  private batches: Record<Shape, THREE.InstancedMesh>;
  private indices: Record<Shape, number> = { box: 0, round: 0, limb: 0, hair: 0, shadow: 0 };
  private colors: Record<Shape, THREE.Color[]> = { box: [], round: [], limb: [], hair: [], shadow: [] };

  constructor() {
    const surface = new THREE.MeshStandardMaterial({ roughness: .95, flatShading: true });
    this.batches = {
      box: new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), surface, 500),
      round: new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), surface, 160),
      limb: new THREE.InstancedMesh(new THREE.CylinderGeometry(1, .88, 1, 6), surface, 400),
      hair: new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 5, 0, TAU, 0, Math.PI * .58), surface, 30),
      shadow: new THREE.InstancedMesh(new THREE.CircleGeometry(1, 16),
        new THREE.MeshBasicMaterial({ color: "#364b39", transparent: true, opacity: .13, depthWrite: false }), 30),
    };
    let station = 0;
    const staticActions: Action[] = ["browse", "reach", "read", "turn-page", "write", "photograph", "sit"];
    for (let i = 0; i < this.count; i++) {
      const action: Action = i < 6 ? (i % 2 ? "carry" : "walk") : i < 27 ? staticActions[(i - 6) % 7] : "chat";
      const angle = i < 6 ? (i + .4) / 6 * TAU : i < 27 ? (station++ + .6) / 24 * TAU + Math.sin(i * 2.4) * .025 : 6.04 + (i - 28) * .105;
      const radius = i < 6 ? 4.03 + (i % 2) * .15 : i >= 27 ? (i === 28 ? 4.46 : 4.93)
        : action === "browse" || action === "reach" ? 5.02 : action === "photograph" ? 4.58 : 4.68 + (i % 3) * .07;
      this.visitors.push(this.makeVisitor(i, action, angle, radius));
    }
    for (const shape of Object.keys(this.batches) as Shape[]) {
      const batch = this.batches[shape];
      batch.count = this.indices[shape];
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      batch.frustumCulled = false;
      // Paper shadows are cached; small moving contact shadows belong to the visitors.
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

  private arm(parent: THREE.Object3D, side: number, shirt: string, skin: string): Arm {
    const upper = this.pivot(parent, [side * .112, .207, 0]);
    this.part("limb", upper, [0, -.055, 0], [.037, .11, .037], shirt);
    const lower = this.pivot(upper, [0, -.107, 0]);
    this.part("limb", lower, [0, -.052, 0], [.025, .105, .025], skin);
    this.part("round", lower, [0, -.111, 0], [.029, .038, .027], skin);
    return { upper, lower };
  }

  private leg(parent: THREE.Object3D, side: number, trousers: string): Arm {
    const upper = this.pivot(parent, [side * .05, .289, 0]);
    this.part("limb", upper, [0, -.067, 0], [.041, .134, .044], trousers);
    const lower = this.pivot(upper, [0, -.134, 0]);
    this.part("limb", lower, [0, -.061, 0], [.031, .122, .033], trousers);
    this.part("box", lower, [0, -.122, .023], [.075, .041, .13], "#ede8dc");
    return { upper, lower };
  }

  private makeVisitor(index: number, action: Action, angle: number, radius: number): Visitor {
    const model = new THREE.Group();
    model.scale.setScalar(1.12 + (index % 3) * .035);
    const shirt = SHIRTS[index % SHIRTS.length], skin = SKIN[index % SKIN.length];
    const body = this.pivot(model, [0, .29, 0]);
    this.part("limb", body, [0, .111, 0], [.099, .228, .069], shirt);
    this.part("limb", body, [0, .246, 0], [.034, .047, .033], skin);
    const head = this.pivot(body, [0, .263, 0]);
    this.part("round", head, [0, .055, 0], [.071, .083, .067], skin);
    this.part("hair", head, [0, .06, -.008], [.076, .086, .07], HAIR[index % HAIR.length]);
    // A small nose makes the viewing direction legible without drawing facial detail.
    this.part("round", head, [0, .043, .06], [.022, .021, .028], skin);
    const leftArm = this.arm(body, -1, shirt, skin), rightArm = this.arm(body, 1, shirt, skin);
    const leftLeg = this.leg(model, -1, TROUSERS[index % 4]), rightLeg = this.leg(model, 1, TROUSERS[index % 4]);
    const book = this.pivot(model, [0, .385, .20]);
    book.rotation.x = .3;
    this.part("box", book, [0, 0, 0], [.235, .025, .16], "#9b6d4d");
    this.part("box", book, [-.056, .019, 0], [.106, .012, .145], "#fffdf0");
    this.part("box", book, [.056, .019, 0], [.106, .012, .145], "#fffdf0");
    const leaf = this.pivot(book, [0, .029, 0]);
    this.part("box", leaf, [.056, 0, 0], [.108, .004, .144], "#fffef5");
    const board = this.pivot(model, [-.035, .4, .20]);
    board.rotation.x = .45;
    this.part("box", board, [0, 0, 0], [.16, .02, .20], "#8d7758");
    this.part("box", board, [0, .014, 0], [.139, .007, .168], "#fffcef");
    if (action === "write") this.part("box", rightArm.lower, [0, -.105, .025], [.009, .11, .009], "#3b5055", [.7, 0, 0]);
    const camera = this.pivot(model, [0, .56, .15]);
    this.part("box", camera, [0, 0, 0], [.145, .086, .064], "#3c4a46");
    this.part("limb", camera, [.021, 0, .045], [.033, .044, .033], "#748481", [Math.PI / 2, 0, 0]);
    const folder = this.pivot(model, [.16, .285, .028]);
    this.part("box", folder, [0, 0, 0], [.04, .21, .16], "#bc965e");
    this.part("box", folder, [0, .011, .008], [.046, .182, .143], "#eee8d8");
    if (action === "sit") {
      this.part("box", model, [0, .17, -.012], [.27, .045, .24], "#a5ad97");
      for (const x of [-.085, .085]) {
        for (const z of [-.085, .06]) this.part("limb", model, [x, .084, z], [.016, .168, .016], "#8e9785");
      }
    }
    this.part("shadow", model, [0, .008, .015], [.15, .105, 1], "#ffffff", [-Math.PI / 2, 0, 0]);
    book.scale.setScalar(["read", "turn-page", "sit", "reach"].includes(action) ? 1 : 0);
    board.scale.setScalar(action === "write" ? 1 : 0);
    camera.scale.setScalar(action === "photograph" ? 1 : 0);
    folder.scale.setScalar(action === "carry" ? 1 : 0);
    return { model, body, head, leftArm, rightArm, leftLeg, rightLeg, book, leaf, board, camera, folder,
      action, angle, radius, phase: index * 2.39996 };
  }

  update(time: number) {
    for (const v of this.visitors) {
      const t = time + v.phase;
      const breath = Math.sin(t * 1.5) * .006;
      const walking = v.action === "walk" || v.action === "carry";
      // Visitors stay in clear circular aisles, never among the paper instances.
      const angle = v.angle + (walking ? Math.sin(t * .052) * .36 : 0);
      v.model.position.set(Math.sin(angle) * v.radius, .008, Math.cos(angle) * v.radius);
      v.model.rotation.y = angle + (walking ? (Math.cos(t * .052) >= 0 ? Math.PI / 2 : -Math.PI / 2)
        : ["browse", "reach", "photograph"].includes(v.action) ? 0 : Math.PI);
      v.body.position.y = .29 + breath;
      v.body.rotation.set(0, 0, 0);
      v.head.rotation.set(.06, Math.sin(t * .45) * .14, 0);
      for (const limb of [v.leftArm, v.rightArm, v.leftLeg, v.rightLeg]) {
        limb.upper.rotation.set(0, 0, 0); limb.lower.rotation.set(0, 0, 0);
      }
      v.leftArm.upper.rotation.z = -.08; v.rightArm.upper.rotation.z = .08;
      v.leftLeg.upper.position.y = v.rightLeg.upper.position.y = .289;
      v.book.position.set(0, .385, .20);
      if (walking) {
        const stride = Math.sin(t * 5.2) * .31 * Math.abs(Math.cos(t * .052));
        v.leftLeg.upper.rotation.x = stride; v.rightLeg.upper.rotation.x = -stride;
        v.leftLeg.lower.rotation.x = Math.max(0, -stride) * .7;
        v.rightLeg.lower.rotation.x = Math.max(0, stride) * .7;
        v.leftArm.upper.rotation.x = -stride * .8;
        v.rightArm.upper.rotation.x = v.action === "carry" ? -.2 : stride * .8;
        v.body.position.y += Math.abs(Math.sin(t * 5.2)) * .008;
      } else if (v.action === "browse") {
        v.head.rotation.y = Math.sin(t * .7) * .45;
        v.body.rotation.x = .13;
        v.rightArm.upper.rotation.x = -.65 - Math.sin(t) * .18;
        v.rightArm.lower.rotation.x = -.55;
      } else if (v.action === "reach") {
        const reach = (Math.sin(t * .6) + 1) / 2;
        v.rightArm.upper.rotation.x = -1.05 - reach * .9;
        v.rightArm.lower.rotation.x = -.28;
        v.leftArm.upper.rotation.x = -.65;
        v.leftArm.lower.rotation.x = -.7;
        v.body.rotation.x = reach * .13;
        v.book.position.set(.06, .4 + reach * .19, .23 + reach * .055);
        v.book.rotation.z = -.12 + reach * .2;
      } else if (["read", "turn-page", "write", "sit"].includes(v.action)) {
        v.head.rotation.x = .3;
        v.leftArm.upper.rotation.x = -.7; v.leftArm.lower.rotation.x = -.8;
        v.rightArm.upper.rotation.x = -.68; v.rightArm.lower.rotation.x = -.9;
        if (v.action === "turn-page") {
          const turn = Math.max(0, Math.sin(t * .9));
          v.leaf.rotation.z = turn * 2.7;
          v.rightArm.upper.rotation.z = .08 - turn * .48;
          v.rightArm.lower.rotation.x -= turn * .25;
        } else if (v.action === "write") {
          v.rightArm.upper.rotation.z = -.32 + Math.sin(t * 3) * .06;
          v.rightArm.lower.rotation.x = -1.15 + Math.sin(t * 4.4) * .09;
        } else if (v.action === "sit") {
          v.body.position.y -= .105;
          for (const leg of [v.leftLeg, v.rightLeg]) {
            leg.upper.position.y = .184;
            leg.upper.rotation.x = -1.35; leg.lower.rotation.x = 1.35;
          }
          v.rightLeg.lower.rotation.x += Math.sin(t * 1.8) * .12;
          v.book.position.y = .28;
        }
      } else if (v.action === "chat") {
        const cx = Math.sin(6.04) * 4.72, cz = Math.cos(6.04) * 4.72;
        v.model.rotation.y = Math.atan2(cx - v.model.position.x, cz - v.model.position.z);
        v.head.rotation.x = Math.sin(t * 1.8) * .1;
        v.rightArm.upper.rotation.x = -.45 - (Math.sin(t * 1.3) + 1) * .22;
        v.rightArm.upper.rotation.z = .35;
        v.rightArm.lower.rotation.x = -.8;
      } else if (v.action === "photograph") {
        const raise = (Math.sin(t * .45) + 1) / 2;
        v.leftArm.upper.rotation.x = v.rightArm.upper.rotation.x = -1.05 - raise * .3;
        v.leftArm.lower.rotation.x = v.rightArm.lower.rotation.x = -1.45;
        v.leftArm.upper.rotation.z = -.2; v.rightArm.upper.rotation.z = .2;
        v.camera.position.y = .49 + raise * .075;
        v.head.rotation.y = 0;
      }
      v.model.updateMatrixWorld(true);
    }
    for (const { node, shape, index } of this.parts) this.batches[shape].setMatrixAt(index, node.matrixWorld);
    for (const batch of Object.values(this.batches)) batch.instanceMatrix.needsUpdate = true;
  }
}
