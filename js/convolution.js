/**
 * Модуль свёртки изображений
 * Поддерживает ядра 3×3 и стратегии обработки краёв (edge handling)
 */
export class Convolution {
    /**
     * Стратегии обработки краёв
     */
    static get edgeModes() {
        return {
            black: 0,
            white: 255,
            clamp: 'clamp'
        };
    }

    /**
     * Применяет свёртку с ядром 3×3 к изображению
     * @param {ImageData} sourceData - исходные данные
     * @param {Array<Array<number>>} kernel - ядро 3×3
     * @param {Object} channels - какие каналы обрабатывать {red, green, blue, alpha}
     * @param {string} edgeMode - 'black', 'white', 'clamp'
     * @returns {ImageData}
     */
    static apply(sourceData, kernel, channels = { red: true, green: true, blue: true, alpha: false }, edgeMode = 'clamp') {
        const width = sourceData.width;
        const height = sourceData.height;
        const src = sourceData.data;
        
        const result = new ImageData(width, height);
        const dst = result.data;

        // Сумма элементов ядра для нормализации
        const kernelSum = kernel[0][0] + kernel[0][1] + kernel[0][2] +
                          kernel[1][0] + kernel[1][1] + kernel[1][2] +
                          kernel[2][0] + kernel[2][1] + kernel[2][2];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dstIndex = (y * width + x) * 4;

                // Для каждого канала
                for (let c = 0; c < 4; c++) {
                    const channelName = ['red', 'green', 'blue', 'alpha'][c];
                    
                    if (!channels[channelName]) {
                        // Канал не выбран — копируем исходное значение
                        dst[dstIndex + c] = src[dstIndex + c];
                        continue;
                    }

                    let sum = 0;

                    // Применяем ядро 3×3
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const pixelValue = this._getPixel(src, width, height, x + kx, y + ky, c, edgeMode);
                            sum += pixelValue * kernel[ky + 1][kx + 1];
                        }
                    }

                    // Нормализация
                    if (kernelSum !== 0) {
                        sum = sum / kernelSum;
                    }

                    // Clamp в 0-255
                    dst[dstIndex + c] = Math.max(0, Math.min(255, Math.round(sum)));
                }
            }
        }

        return result;
    }

    /**
     * Получает значение пикселя с учётом стратегии обработки краёв
     * @param {Uint8ClampedArray} src - исходные данные
     * @param {number} width - ширина
     * @param {number} height - высота
     * @param {number} x - координата X
     * @param {number} y - координата Y
     * @param {number} channel - индекс канала (0-3)
     * @param {string} edgeMode - 'black', 'white', 'clamp'
     * @returns {number}
     */
    static _getPixel(src, width, height, x, y, channel, edgeMode) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
            // Внутри изображения — возвращаем реальное значение
            return src[(y * width + x) * 4 + channel];
        }

        // Край — применяем стратегию
        switch (edgeMode) {
            case 'black':
                return 0;
            case 'white':
                return 255;
            case 'clamp':
                // Копируем ближайший крайний пиксель
                const clampedX = Math.max(0, Math.min(x, width - 1));
                const clampedY = Math.max(0, Math.min(y, height - 1));
                return src[(clampedY * width + clampedX) * 4 + channel];
            default:
                return 0;
        }
    }
}