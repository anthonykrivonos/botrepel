/**
 * sRGB code values (0–255) and linear light on the same scale. Light from the screen and the room
 * adds up linearly, so the reflection model only holds once both sides are linear.
 */
export const toLinear = (value: number): number => {
  const v = value / 255;
  return 255 * (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
};

export const toSrgb = (value: number): number => {
  const v = Math.max(0, value) / 255;
  return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
};

/** Linear light for every code value. */
export const LINEAR = Float64Array.from({ length: 256 }, (_, value) => toLinear(value));

/** Perceived brightness of linear RGB. */
export const luma = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;
