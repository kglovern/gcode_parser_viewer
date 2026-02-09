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
exports.GCodeViewer = void 0;
const THREE = __importStar(require("three"));
const OrbitControls_js_1 = require("three/examples/jsm/controls/OrbitControls.js");
const threejs_core_1 = require("../threejs-core");
const types_1 = require("./types");
const three_helpers_1 = require("./three-helpers");
const MM_PER_INCH = 25.4;
class GCodeViewer {
    constructor(args) {
        this.resizeObserver = null;
        this.animationFrameId = null;
        this.gridGroup = null;
        this.axesGroup = null;
        this.gridLabelsGroup = null;
        this.boundingBoxGroup = null;
        this.rapidLine = null;
        this.movementLine = null;
        this.laserLines = [];
        this.currentLines = [];
        this.renderSequence = 0;
        this.currentBounds = null;
        this.cameraFocusTransition = null;
        this.id = args.id;
        this.container = args.container;
        this.callbacks = args.callbacks ?? {};
        this.options = mergeOptions(types_1.defaultGCodeViewerOptions, args.options);
        this.canvas = document.createElement("canvas");
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.style.display = "block";
        this.container.appendChild(this.canvas);
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: this.options.render.antialias,
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(this.options.render.theme.background, 1);
        this.scene = new THREE.Scene();
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        this.scene.add(new THREE.DirectionalLight(0xffffff, 0.6));
        this.camera = new THREE.PerspectiveCamera(this.options.camera.fov, 1, 0.1, 100000);
        this.camera.position.set(this.options.camera.initialPosition.x, this.options.camera.initialPosition.y, this.options.camera.initialPosition.z);
        this.controls = new OrbitControls_js_1.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = this.options.camera.orbit.enableDamping;
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
        this.renderGridAndAxes();
        this.refreshGridLabels();
        this.refreshBoundingBox();
        this.resize();
        this.startAnimationLoop();
    }
    setCallbacks(callbacks) {
        this.callbacks = callbacks;
    }
    async loadFromUrl(url, args = {}) {
        this.emitProgress({ state: "indeterminate", label: "Loading file..." });
        const response = await fetch(url, { signal: args.signal });
        if (!response.ok) {
            this.emitProgress({ state: "hidden" });
            throw new Error(`Failed to load gcode: ${response.statusText}`);
        }
        const text = await response.text();
        await this.loadFromText(text);
    }
    async loadFromFile(file) {
        this.emitProgress({ state: "indeterminate", label: "Loading file..." });
        const text = await file.text();
        await this.loadFromText(text);
    }
    async loadFromText(gcode) {
        await this.loadFromLines(gcode.split(/\\r?\\n/));
    }
    async loadFromLines(lines) {
        this.currentLines = Array.from(lines);
        await this.renderScene();
    }
    unload() {
        this.currentLines = [];
        this.setGeometryEmpty();
        this.emitProgress({ state: "hidden" });
    }
    setOptions(next) {
        const previous = this.options;
        this.options = mergeOptions(this.options, next);
        if (previous.render.antialias !== this.options.render.antialias ||
            previous.render.theme.background !== this.options.render.theme.background) {
            this.renderer.setClearColor(this.options.render.theme.background, 1);
        }
        if (previous.camera.fov !== this.options.camera.fov) {
            this.camera.fov = this.options.camera.fov;
            this.camera.updateProjectionMatrix();
        }
        if (previous.camera.orbit.enableDamping !== this.options.camera.orbit.enableDamping) {
            this.controls.enableDamping = this.options.camera.orbit.enableDamping;
        }
        const gridLayoutChanged = previous.units !== this.options.units ||
            previous.grid.size !== this.options.grid.size ||
            previous.grid.axisDepth !== this.options.grid.axisDepth;
        const gridStyleChanged = previous.render.theme.colors.grid.major !== this.options.render.theme.colors.grid.major ||
            previous.render.theme.colors.grid.minor !== this.options.render.theme.colors.grid.minor ||
            previous.render.theme.colors.axes.x !== this.options.render.theme.colors.axes.x ||
            previous.render.theme.colors.axes.y !== this.options.render.theme.colors.axes.y ||
            previous.render.theme.colors.axes.z !== this.options.render.theme.colors.axes.z;
        if (gridLayoutChanged || gridStyleChanged) {
            this.renderGridAndAxes();
        }
        const gridLabelsChanged = previous.grid.labels !== this.options.grid.labels ||
            previous.units !== this.options.units ||
            previous.grid.size !== this.options.grid.size ||
            gridStyleChanged;
        if (gridLabelsChanged) {
            this.refreshGridLabels();
        }
        const bboxChanged = previous.boundingBox.visible !== this.options.boundingBox.visible ||
            previous.boundingBox.labels !== this.options.boundingBox.labels ||
            previous.units !== this.options.units ||
            previous.render.theme.colors.boundingBox !== this.options.render.theme.colors.boundingBox;
        if (bboxChanged) {
            this.refreshBoundingBox();
        }
        if (previous.mode.laser !== this.options.mode.laser) {
            void this.renderScene();
        }
    }
    getOptions() {
        return this.options;
    }
    resize() {
        const width = Math.max(1, Math.floor(this.container.clientWidth));
        const height = Math.max(1, Math.floor(this.container.clientHeight));
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }
    focusToModel() {
        if (!this.currentBounds) {
            return;
        }
        this.startCameraFocus(this.currentBounds);
    }
    resetCamera() {
        this.cameraFocusTransition = null;
        this.controls.enableDamping = this.options.camera.orbit.enableDamping;
        this.controls.target.set(0, 0, 0);
        this.camera.position.set(this.options.camera.initialPosition.x, this.options.camera.initialPosition.y, this.options.camera.initialPosition.z);
        this.controls.update();
    }
    getBounds() {
        if (!this.currentBounds) {
            return null;
        }
        return {
            min: {
                x: this.currentBounds.min.x,
                y: this.currentBounds.min.y,
                z: this.currentBounds.min.z,
            },
            max: {
                x: this.currentBounds.max.x,
                y: this.currentBounds.max.y,
                z: this.currentBounds.max.z,
            },
        };
    }
    dispose() {
        this.renderSequence += 1;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        this.setGeometryEmpty();
        this.setGridGroup(null);
        this.setAxesGroup(null);
        this.setGridLabelsGroup(null);
        this.setBoundingBoxGroup(null);
        this.controls.dispose();
        this.renderer.dispose();
        this.container.removeChild(this.canvas);
    }
    emitProgress(event) {
        this.callbacks.onProgress?.({ id: this.id, ...event });
    }
    emitBoundsChanged() {
        this.callbacks.onBoundsChanged?.({ id: this.id, bounds: this.getBounds() });
    }
    startAnimationLoop() {
        const tick = () => {
            this.animationFrameId = requestAnimationFrame(tick);
            this.updateCameraFocusTransition();
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };
        tick();
    }
    worldSizes() {
        const scale = this.options.units === "in" ? MM_PER_INCH : 1;
        return {
            sizeMm: Math.max(1, this.options.grid.size * scale),
            axisDepthMm: Math.max(1, this.options.grid.axisDepth * scale),
        };
    }
    renderGridAndAxes() {
        const { sizeMm, axisDepthMm } = this.worldSizes();
        this.setGridGroup((0, three_helpers_1.createUnitGrid)({
            units: this.options.units,
            sizeMm,
            theme: this.options.render.theme,
        }));
        this.setAxesGroup((0, three_helpers_1.createAxes)({ sizeWorld: sizeMm, depthWorld: axisDepthMm, theme: this.options.render.theme }));
    }
    refreshGridLabels() {
        if (!this.options.grid.labels) {
            this.setGridLabelsGroup(null);
            return;
        }
        const { sizeMm } = this.worldSizes();
        this.setGridLabelsGroup((0, three_helpers_1.createGridLabels)({ sizeMm, units: this.options.units, theme: this.options.render.theme }));
    }
    refreshBoundingBox() {
        if (!this.options.boundingBox.visible || !this.currentBounds) {
            this.setBoundingBoxGroup(null);
            return;
        }
        const group = new THREE.Group();
        const helper = new THREE.Box3Helper(this.currentBounds.clone(), new THREE.Color(this.options.render.theme.colors.boundingBox));
        const helperMaterial = helper.material;
        helperMaterial.transparent = true;
        helperMaterial.opacity = 0.12;
        helperMaterial.depthWrite = false;
        group.add(helper);
        if (this.options.boundingBox.labels) {
            group.add(...createBoundingBoxLabels(this.currentBounds.clone(), this.options));
        }
        this.setBoundingBoxGroup(group);
    }
    setGridGroup(group) {
        if (this.gridGroup) {
            this.scene.remove(this.gridGroup);
            (0, three_helpers_1.disposeLineSegmentsGroup)(this.gridGroup);
            this.gridGroup = null;
        }
        if (group) {
            this.gridGroup = group;
            this.scene.add(group);
        }
    }
    setAxesGroup(group) {
        if (this.axesGroup) {
            this.scene.remove(this.axesGroup);
            (0, three_helpers_1.disposeAxesGroup)(this.axesGroup);
            this.axesGroup = null;
        }
        if (group) {
            this.axesGroup = group;
            this.scene.add(group);
        }
    }
    setGridLabelsGroup(group) {
        if (this.gridLabelsGroup) {
            this.scene.remove(this.gridLabelsGroup);
            (0, three_helpers_1.disposeSpriteGroup)(this.gridLabelsGroup);
            this.gridLabelsGroup = null;
        }
        if (group) {
            this.gridLabelsGroup = group;
            this.scene.add(group);
        }
    }
    setBoundingBoxGroup(group) {
        if (this.boundingBoxGroup) {
            this.scene.remove(this.boundingBoxGroup);
            (0, three_helpers_1.disposeBoundingBoxGroup)(this.boundingBoxGroup);
            this.boundingBoxGroup = null;
        }
        if (group) {
            this.boundingBoxGroup = group;
            this.scene.add(group);
        }
    }
    setGeometryEmpty() {
        if (this.rapidLine) {
            this.scene.remove(this.rapidLine);
            this.rapidLine.geometry.dispose();
            this.rapidLine.material.dispose();
            this.rapidLine = null;
        }
        if (this.movementLine) {
            this.scene.remove(this.movementLine);
            this.movementLine.geometry.dispose();
            this.movementLine.material.dispose();
            this.movementLine = null;
        }
        for (const line of this.laserLines) {
            this.scene.remove(line);
            line.geometry.dispose();
            line.material.dispose();
        }
        this.laserLines = [];
        this.currentBounds = null;
        this.emitBoundsChanged();
        this.refreshBoundingBox();
    }
    setMovementGeometry(rapid, cutting) {
        this.setGeometryEmpty();
        const totalFloats = rapid.length + cutting.length;
        if (totalFloats === 0) {
            return;
        }
        const positions = new Float32Array(totalFloats);
        positions.set(rapid, 0);
        positions.set(cutting, rapid.length);
        const rapidColor = new THREE.Color(this.options.render.theme.colors.rapid);
        const cutColor = new THREE.Color(this.options.render.theme.colors.cutting);
        const vertexCount = totalFloats / 3;
        const colors = new Float32Array(vertexCount * 3);
        const rapidVertexCount = rapid.length / 3;
        for (let i = 0; i < vertexCount; i += 1) {
            const color = i < rapidVertexCount ? rapidColor : cutColor;
            const offset = i * 3;
            colors[offset] = color.r;
            colors[offset + 1] = color.g;
            colors[offset + 2] = color.b;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geometry.computeBoundingBox();
        this.currentBounds = geometry.boundingBox ? geometry.boundingBox.clone() : null;
        this.emitBoundsChanged();
        this.refreshBoundingBox();
        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: this.options.render.theme.opacity,
        });
        this.movementLine = new THREE.LineSegments(geometry, material);
        this.scene.add(this.movementLine);
    }
    setLaserGeometry(rapid, buckets, opacities) {
        this.setGeometryEmpty();
        if (rapid.length > 0) {
            const rapidGeometry = new THREE.BufferGeometry();
            rapidGeometry.setAttribute("position", new THREE.BufferAttribute(rapid, 3));
            rapidGeometry.computeBoundingBox();
            const rapidMaterial = new THREE.LineBasicMaterial({
                color: new THREE.Color(this.options.render.theme.colors.rapid),
                transparent: true,
                opacity: 0.3,
            });
            this.rapidLine = new THREE.LineSegments(rapidGeometry, rapidMaterial);
            this.scene.add(this.rapidLine);
        }
        const laserColor = new THREE.Color(this.options.render.theme.colors.cutting);
        buckets.forEach((vertices, index) => {
            if (vertices.length === 0) {
                return;
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
            geometry.computeBoundingBox();
            const material = new THREE.LineBasicMaterial({
                color: laserColor,
                transparent: true,
                opacity: opacities[index] ?? this.options.render.theme.opacity,
            });
            const line = new THREE.LineSegments(geometry, material);
            this.laserLines.push(line);
            this.scene.add(line);
        });
        let box = null;
        if (this.rapidLine?.geometry.boundingBox) {
            box = this.rapidLine.geometry.boundingBox.clone();
        }
        for (const line of this.laserLines) {
            if (line.geometry.boundingBox) {
                box = box ? box.union(line.geometry.boundingBox) : line.geometry.boundingBox.clone();
            }
        }
        this.currentBounds = box ? box.clone() : null;
        this.emitBoundsChanged();
        this.refreshBoundingBox();
    }
    async renderScene() {
        if (this.currentLines.length === 0) {
            this.setGeometryEmpty();
            this.emitProgress({ state: "hidden" });
            return;
        }
        const mySequence = (this.renderSequence += 1);
        try {
            if (this.options.mode.laser) {
                this.emitProgress({ state: "indeterminate", label: "Scanning power..." });
                const result = await (0, threejs_core_1.buildLaserVerticesFromLinesBatched)(this.currentLines, {
                    arcSegments: this.options.geometry.arcSegments,
                    bucketCount: 16,
                    baseOpacity: this.options.render.theme.opacity,
                    batch: {
                        everyLines: this.options.geometry.batching.progressEveryLines,
                        yieldEveryLines: this.options.geometry.batching.yieldEveryLines,
                        shouldAbort: () => mySequence !== this.renderSequence,
                        onProgress: (processed, total) => {
                            if (mySequence !== this.renderSequence) {
                                return;
                            }
                            this.emitProgress({ state: "determinate", label: "Building geometry...", processed, total });
                        },
                    },
                });
                if (mySequence !== this.renderSequence) {
                    return;
                }
                this.setLaserGeometry(result.rapid, result.buckets.map((bucket) => bucket.vertices), result.buckets.map((bucket) => bucket.opacity));
            }
            else {
                this.emitProgress({
                    state: "determinate",
                    label: "Building geometry...",
                    processed: 0,
                    total: this.currentLines.length,
                });
                const result = await (0, threejs_core_1.buildMovementVerticesFromLinesBatched)(this.currentLines, {
                    arcSegments: this.options.geometry.arcSegments,
                    batch: {
                        everyLines: this.options.geometry.batching.progressEveryLines,
                        yieldEveryLines: this.options.geometry.batching.yieldEveryLines,
                        shouldAbort: () => mySequence !== this.renderSequence,
                        onProgress: (processed, total) => {
                            if (mySequence !== this.renderSequence) {
                                return;
                            }
                            this.emitProgress({ state: "determinate", label: "Building geometry...", processed, total });
                        },
                    },
                });
                if (mySequence !== this.renderSequence) {
                    return;
                }
                this.setMovementGeometry(result.rapid, result.cutting);
            }
        }
        catch (error) {
            if (error instanceof Error && error.message === "Aborted.") {
                return;
            }
            throw error;
        }
        finally {
            if (mySequence === this.renderSequence) {
                this.emitProgress({ state: "hidden" });
            }
        }
    }
    startCameraFocus(bounds) {
        const center = new THREE.Vector3();
        bounds.getCenter(center);
        const size = new THREE.Vector3();
        bounds.getSize(size);
        const halfMax = Math.max(size.x, size.y, 1) / 2;
        const fovRadians = THREE.MathUtils.degToRad(this.camera.fov);
        const distance = (halfMax / Math.tan(fovRadians / 2)) * 1.25 + size.z;
        const toPosition = new THREE.Vector3(center.x, center.y, center.z + distance);
        const maxDim = Math.max(size.x, size.y, size.z, 1);
        this.camera.near = maxDim / 1000;
        this.camera.far = maxDim * 50;
        this.camera.updateProjectionMatrix();
        if (this.cameraFocusTransition) {
            this.controls.enableDamping = this.cameraFocusTransition.dampingEnabled;
        }
        this.cameraFocusTransition = {
            startedAt: performance.now(),
            duration: this.options.camera.focusDurationMs,
            fromPosition: this.camera.position.clone(),
            toPosition,
            fromTarget: this.controls.target.clone(),
            toTarget: center,
            dampingEnabled: this.controls.enableDamping,
        };
        this.controls.enableDamping = false;
    }
    updateCameraFocusTransition() {
        if (!this.cameraFocusTransition) {
            return;
        }
        const now = performance.now();
        const elapsed = now - this.cameraFocusTransition.startedAt;
        const t = Math.min(1, Math.max(0, elapsed / this.cameraFocusTransition.duration));
        const eased = easeInOutCubic(t);
        this.camera.position.lerpVectors(this.cameraFocusTransition.fromPosition, this.cameraFocusTransition.toPosition, eased);
        this.controls.target.lerpVectors(this.cameraFocusTransition.fromTarget, this.cameraFocusTransition.toTarget, eased);
        if (t >= 1) {
            this.controls.enableDamping = this.cameraFocusTransition.dampingEnabled;
            this.cameraFocusTransition = null;
        }
    }
}
exports.GCodeViewer = GCodeViewer;
function easeInOutCubic(t) {
    if (t < 0.5) {
        return 4 * t * t * t;
    }
    const inv = -2 * t + 2;
    return 1 - (inv * inv * inv) / 2;
}
function mergeOptions(base, next) {
    if (!next) {
        return { ...base };
    }
    const mergedTheme = mergeTheme(base.render.theme, next.render?.theme);
    return {
        ...base,
        ...next,
        mode: { ...base.mode, ...next.mode },
        grid: { ...base.grid, ...next.grid },
        boundingBox: { ...base.boundingBox, ...next.boundingBox },
        geometry: {
            ...base.geometry,
            ...next.geometry,
            batching: { ...base.geometry.batching, ...next.geometry?.batching },
        },
        render: {
            ...base.render,
            ...next.render,
            theme: mergedTheme,
        },
        camera: {
            ...base.camera,
            ...next.camera,
            orbit: { ...base.camera.orbit, ...next.camera?.orbit },
            initialPosition: { ...base.camera.initialPosition, ...next.camera?.initialPosition },
        },
    };
}
function mergeTheme(base, next) {
    if (!next) {
        return base;
    }
    return {
        ...base,
        ...next,
        colors: {
            ...base.colors,
            ...next.colors,
            grid: { ...base.colors.grid, ...next.colors?.grid },
            axes: { ...base.colors.axes, ...next.colors?.axes },
        },
    };
}
function createBoundingBoxLabels(bounds, options) {
    const color = options.render.theme.colors.boundingBox;
    const labelFont = "600 14px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
    const labelOpacity = 0.32;
    const format = (value) => {
        if (Math.abs(value) < 1e-9) {
            return "0";
        }
        return value.toFixed(3);
    };
    const formatWithUnits = (valueMm) => {
        if (options.units === "in") {
            return `${format(valueMm / MM_PER_INCH)} in`;
        }
        return `${format(valueMm)} mm`;
    };
    const min = bounds.min;
    const max = bounds.max;
    const make = (text) => (0, three_helpers_1.createTextSprite)(text, color, { font: labelFont, padding: 8, opacity: labelOpacity });
    const xMinLabel = make(formatWithUnits(min.x));
    const xMaxLabel = make(formatWithUnits(max.x));
    const yMinLabel = make(formatWithUnits(min.y));
    const yMaxLabel = make(formatWithUnits(max.y));
    const zMinLabel = make(formatWithUnits(min.z));
    const zMaxLabel = make(formatWithUnits(max.z));
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const offset = Math.max(2, Math.max(size.x, size.y, size.z) * 0.02);
    const centerX = (min.x + max.x) / 2;
    const centerY = (min.y + max.y) / 2;
    const centerZ = (min.z + max.z) / 2;
    xMinLabel.position.set(min.x - offset, centerY, min.z - offset);
    xMaxLabel.position.set(max.x + offset, centerY, min.z - offset);
    yMinLabel.position.set(centerX, min.y - offset, min.z - offset);
    yMaxLabel.position.set(centerX, max.y + offset, min.z - offset);
    zMinLabel.position.set(centerX, centerY, min.z - offset);
    zMaxLabel.position.set(centerX, centerY, max.z + offset);
    const scale = 9;
    xMinLabel.scale.set(scale, scale, 1);
    xMaxLabel.scale.set(scale, scale, 1);
    yMinLabel.scale.set(scale, scale, 1);
    yMaxLabel.scale.set(scale, scale, 1);
    zMinLabel.scale.set(scale, scale, 1);
    zMaxLabel.scale.set(scale, scale, 1);
    return [xMinLabel, xMaxLabel, yMinLabel, yMaxLabel, zMinLabel, zMaxLabel];
}
