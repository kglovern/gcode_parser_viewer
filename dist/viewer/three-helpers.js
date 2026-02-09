"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUnitGrid = createUnitGrid;
exports.disposeLineSegmentsGroup = disposeLineSegmentsGroup;
exports.createTextSprite = createTextSprite;
exports.disposeSpriteGroup = disposeSpriteGroup;
exports.createAxes = createAxes;
exports.disposeAxesGroup = disposeAxesGroup;
exports.createGridLabels = createGridLabels;
exports.disposeBoundingBoxGroup = disposeBoundingBoxGroup;
const THREE = __importStar(require("three"));
const MM_PER_INCH = 25.4;
function createUnitGrid(args) {
    const sizeWorld = Math.max(1, args.sizeMm);
    const half = sizeWorld / 2;
    const stepWorld = args.units === "mm" ? 10 : MM_PER_INCH;
    const count = Math.max(0, Math.floor(half / stepWorld));
    const centerVertices = [];
    const gridVertices = [];
    const pushLineXY = (x1, y1, x2, y2, target) => {
        target.push(x1, y1, 0, x2, y2, 0);
    };
    for (let i = -count; i <= count; i += 1) {
        const y = i * stepWorld;
        pushLineXY(-half, y, half, y, i === 0 ? centerVertices : gridVertices);
    }
    for (let i = -count; i <= count; i += 1) {
        const x = i * stepWorld;
        pushLineXY(x, -half, x, half, i === 0 ? centerVertices : gridVertices);
    }
    const group = new THREE.Group();
    if (gridVertices.length > 0) {
        group.add(createLineSegments(gridVertices, args.theme.colors.grid.minor, 0.5));
    }
    if (centerVertices.length > 0) {
        group.add(createLineSegments(centerVertices, args.theme.colors.grid.major, 0.6));
    }
    return group;
}
function createLineSegments(vertices, color, opacity) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity,
        depthWrite: false,
    });
    return new THREE.LineSegments(geometry, material);
}
function disposeLineSegmentsGroup(group) {
    group.traverse((child) => {
        if (!(child instanceof THREE.LineSegments)) {
            return;
        }
        child.geometry.dispose();
        const material = child.material;
        if (Array.isArray(material)) {
            material.forEach((entry) => entry.dispose());
        }
        else {
            material.dispose();
        }
    });
}
function createTextSprite(text, color, options = {}) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Missing canvas 2D context.");
    }
    const font = options.font ??
        "600 48px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
    const padding = options.padding ?? 24;
    const opacity = options.opacity ?? 1;
    const dpr = Math.max(1, Math.min(3, Math.floor(window.devicePixelRatio || 1)));
    context.font = font;
    const lines = text.split("\n");
    const lineMetrics = lines.map((line) => context.measureText(line));
    const textWidth = Math.max(...lineMetrics.map((metric) => metric.width), 0);
    const fontSizeMatch = /(\d+)px/.exec(font);
    const lineHeight = fontSizeMatch ? Number(fontSizeMatch[1]) : 48;
    const width = Math.ceil(textWidth + padding * 2);
    const height = Math.ceil(lineHeight * lines.length + padding * 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.font = font;
    context.textBaseline = "top";
    context.fillStyle = color;
    context.globalAlpha = opacity;
    lines.forEach((line, index) => {
        context.fillText(line, padding, padding + index * lineHeight);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    return new THREE.Sprite(material);
}
function disposeSpriteGroup(group) {
    group.traverse((child) => {
        if (!(child instanceof THREE.Sprite)) {
            return;
        }
        const material = child.material;
        material.map?.dispose();
        material.dispose();
    });
}
function createAxes(args) {
    const group = new THREE.Group();
    const half = Math.max(1, args.sizeWorld) / 2;
    const depth = Math.max(1, args.depthWorld);
    const dashSize = Math.max(1, Math.min(half / 12, 30));
    const gapSize = dashSize * 0.6;
    const lineMaterial = (color) => new THREE.LineDashedMaterial({
        color: new THREE.Color(color),
        dashSize,
        gapSize,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
    });
    const xLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-half, 0, 0),
        new THREE.Vector3(half, 0, 0),
    ]), lineMaterial(args.theme.colors.axes.x));
    xLine.computeLineDistances();
    const yLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -half, 0),
        new THREE.Vector3(0, half, 0),
    ]), lineMaterial(args.theme.colors.axes.y));
    yLine.computeLineDistances();
    const zLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, depth),
    ]), lineMaterial(args.theme.colors.axes.z));
    zLine.computeLineDistances();
    group.add(xLine, yLine, zLine);
    const labelOffset = Math.max(2, dashSize);
    const xLabel = createTextSprite("X", args.theme.colors.axes.x);
    xLabel.position.set(half + labelOffset, 0, 0);
    xLabel.scale.set(14, 14, 1);
    const yLabel = createTextSprite("Y", args.theme.colors.axes.y);
    yLabel.position.set(0, half + labelOffset, 0);
    yLabel.scale.set(14, 14, 1);
    const zLabel = createTextSprite("Z", args.theme.colors.axes.z);
    zLabel.position.set(0, 0, depth + labelOffset);
    zLabel.scale.set(14, 14, 1);
    group.add(xLabel, yLabel, zLabel);
    return group;
}
function disposeAxesGroup(group) {
    group.traverse((child) => {
        if (child instanceof THREE.Line) {
            child.geometry.dispose();
            const material = child.material;
            if (Array.isArray(material)) {
                material.forEach((entry) => entry.dispose());
            }
            else {
                material.dispose();
            }
            return;
        }
        if (child instanceof THREE.Sprite) {
            const material = child.material;
            material.map?.dispose();
            material.dispose();
        }
    });
}
function createGridLabels(args) {
    const group = new THREE.Group();
    const halfWorld = Math.max(1, args.sizeMm) / 2;
    const displayStep = args.units === "mm" ? 10 : 1;
    const displayStart = displayStep;
    const displayMax = args.units === "mm" ? halfWorld : halfWorld / MM_PER_INCH;
    const displayIncrement = displayStep * 2;
    const unitScale = args.units === "mm" ? 1 : MM_PER_INCH;
    const font = "600 14px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
    const opacity = 0.5;
    const scale = 9;
    const z = 0.1;
    for (let value = displayStart; value <= displayMax + 1e-6; value += displayIncrement) {
        const worldValue = value * unitScale;
        if (worldValue > halfWorld + 1e-6) {
            continue;
        }
        const xColor = args.theme.colors.axes.x;
        const yColor = args.theme.colors.axes.y;
        const xPos = createTextSprite(String(value), xColor, { font, padding: 8, opacity });
        xPos.position.set(worldValue, 0, z);
        xPos.scale.set(scale, scale, 1);
        const xNeg = createTextSprite(String(-value), xColor, { font, padding: 8, opacity });
        xNeg.position.set(-worldValue, 0, z);
        xNeg.scale.set(scale, scale, 1);
        const yPos = createTextSprite(String(value), yColor, { font, padding: 8, opacity });
        yPos.position.set(0, worldValue, z);
        yPos.scale.set(scale, scale, 1);
        const yNeg = createTextSprite(String(-value), yColor, { font, padding: 8, opacity });
        yNeg.position.set(0, -worldValue, z);
        yNeg.scale.set(scale, scale, 1);
        group.add(xPos, xNeg, yPos, yNeg);
    }
    return group;
}
function disposeBoundingBoxGroup(group) {
    group.traverse((child) => {
        if (child instanceof THREE.LineSegments || child instanceof THREE.Line) {
            child.geometry.dispose();
            const material = child.material;
            if (Array.isArray(material)) {
                material.forEach((entry) => entry.dispose());
            }
            else {
                material.dispose();
            }
            return;
        }
        if (child instanceof THREE.Sprite) {
            const material = child.material;
            material.map?.dispose();
            material.dispose();
        }
    });
}
