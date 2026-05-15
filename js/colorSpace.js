/**
 * Модуль конвертации цветов между пространствами
 * Поддерживает: RGB → XYZ → CIELAB
 * Стандарт: sRGB, D65 reference white
 */
export class ColorSpaceConverter {
    /**
     * RGB (0-255) → CIELAB
     * @param {number} r - Красный (0-255)
     * @param {number} g - Зелёный (0-255)
     * @param {number} b - Синий (0-255)
     * @returns {{L: number, a: number, b: number}} - координаты в CIELAB
     */
    static rgbToLab(r, g, b) {
        const xyz = this.rgbToXyz(r, g, b);
        return this.xyzToLab(xyz.x, xyz.y, xyz.z);
    }

    /**
     * RGB (0-255) → XYZ (D65 reference white)
     * Используется стандарт sRGB с гамма-коррекцией
     */
    static rgbToXyz(r, g, b) {
        // Нормализуем в диапазон 0-1
        let red = r / 255;
        let green = g / 255;
        let blue = b / 255;

        // Линеаризация (обратная гамма-коррекция sRGB)
        red = red > 0.04045 ? Math.pow((red + 0.055) / 1.055, 2.4) : red / 12.92;
        green = green > 0.04045 ? Math.pow((green + 0.055) / 1.055, 2.4) : green / 12.92;
        blue = blue > 0.04045 ? Math.pow((blue + 0.055) / 1.055, 2.4) : blue / 12.92;

        // Матрица преобразования sRGB → XYZ (D65)
        const x = (0.4124564 * red + 0.3575761 * green + 0.1804375 * blue) * 100;
        const y = (0.2126729 * red + 0.7151522 * green + 0.0721750 * blue) * 100;
        const z = (0.0193339 * red + 0.1191920 * green + 0.9503041 * blue) * 100;

        return { x, y, z };
    }

    /**
     * XYZ → CIELAB
     * Используется D65 reference white
     */
    static xyzToLab(x, y, z) {
        // Эталонные значения D65
        const refX = 95.047;
        const refY = 100.000;
        const refZ = 108.883;

        let varX = x / refX;
        let varY = y / refY;
        let varZ = z / refZ;

        // Нелинейное преобразование
        varX = varX > 0.008856 ? Math.cbrt(varX) : (7.787 * varX) + (16 / 116);
        varY = varY > 0.008856 ? Math.cbrt(varY) : (7.787 * varY) + (16 / 116);
        varZ = varZ > 0.008856 ? Math.cbrt(varZ) : (7.787 * varZ) + (16 / 116);

        const L = (116 * varY) - 16;
        const a = 500 * (varX - varY);
        const b = 200 * (varY - varZ);

        return {
            L: Math.round(L * 100) / 100,  // Яркость (0 = чёрный, 100 = белый)
            a: Math.round(a * 100) / 100,  // Зелёный-красный (- = зелёный, + = красный)
            b: Math.round(b * 100) / 100   // Синий-жёлтый (- = синий, + = жёлтый)
        };
    }
}