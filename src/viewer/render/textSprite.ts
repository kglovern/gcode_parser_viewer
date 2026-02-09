import * as THREE from "three";

export type TextSpriteOptions = {
  x?: number;
  y?: number;
  z?: number;
  textAlign?: "left" | "center" | "right";
  textBaseline?: "top" | "middle" | "bottom";
  size?: number;
  opacity?: number;
};

export function createTextSprite(
  text: string,
  color: string,
  options: TextSpriteOptions = {}
): any {
  const { opacity = 1, size = 10 } = options;

  const textObject: any = new THREE.Object3D();
  const textHeight = 100;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Missing canvas 2D context.");
  }

  context.font = `normal ${textHeight}px Arial`;
  const metrics = context.measureText(text);
  const textWidth = metrics.width;

  canvas.width = textWidth;
  canvas.height = textHeight;

  context.font = `normal ${textHeight}px Arial`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;
  context.fillText(text, textWidth / 2, textHeight / 2);

  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
  });

  textObject.textHeight = size;
  textObject.textWidth = (textWidth / textHeight) * textObject.textHeight;

  if (options.textAlign === "left") {
    textObject.position.x = (options.x ?? 0) + (textObject.textWidth ?? 0) / 2;
  } else if (options.textAlign === "right") {
    textObject.position.x = (options.x ?? 0) - (textObject.textWidth ?? 0) / 2;
  } else {
    textObject.position.x = options.x ?? 0;
  }

  if (options.textBaseline === "top") {
    textObject.position.y = (options.y ?? 0) - (textObject.textHeight ?? 0) / 2;
  } else if (options.textBaseline === "bottom") {
    textObject.position.y = (options.y ?? 0) + (textObject.textHeight ?? 0) / 2;
  } else {
    textObject.position.y = options.y ?? 0;
  }

  textObject.position.z = options.z ?? 0;

  const sprite = new THREE.Sprite(material);
  sprite.scale.set((textWidth / textHeight) * size, size, 1);
  textObject.add(sprite);

  return textObject;
}

export function disposeSpriteGroup(group: any): void {
  group.traverse((child: any) => {
    if (!(child instanceof THREE.Sprite)) {
      return;
    }
    const material = child.material as any;
    material.map?.dispose();
    material.dispose();
  });
}

