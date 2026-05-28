/**
 * Модуль свёртки изображений
 * Поддерживает ядра 3×3, стратегии обработки краёв и асинхронную обработку
 */
export class Convolution {
    static get edgeModes() {
        return {
            black: 0,
            white: 255,
            clamp: 'clamp'
        };
    }

    /**
     * Применяет свёртку асинхронно, разбивая на чанки по строкам
     * @param {ImageData} sourceData
     * @param {Array<Array<number>>} kernel
     * @param {Object} channels
     * @param {string} edgeMode
     * @param {number} chunkSize - строк за итерацию
     * @returns {Promise<ImageData>}
     */
    static async applyAsync(sourceData, kernel, channels, edgeMode = 'clamp', chunkSize = 10) {
        const width = sourceData.width;
        const height = sourceData.height;
        const src = sourceData.data;

        const result = new ImageData(width, height);
        const dst = result.data;

        const kernelSum = kernel[0][0] + kernel[0][1] + kernel[0][2] +
                          kernel[1][0] + kernel[1][1] + kernel[1][2] +
                          kernel[2][0] + kernel[2][1] + kernel[2][2];

        let currentY = 0;

        while (currentY < height) {
            const endY = Math.min(currentY + chunkSize, height);

            for (let y = currentY; y < endY; y++) {
                for (let x = 0; x < width; x++) {
                    const dstIndex = (y * width + x) * 4;

                    for (let c = 0; c < 4; c++) {
                        const channelName = ['red', 'green', 'blue', 'alpha'][c];

                        if (!channels[channelName]) {
                            dst[dstIndex + c] = src[dstIndex + c];
                            continue;
                        }

                        let sum = 0;

                        for (let ky = -1; ky <= 1; ky++) {
                            for (let kx = -1; kx <= 1; kx++) {
                                const pixelValue = this._getPixel(src, width, height, x + kx, y + ky, c, edgeMode);
                                sum += pixelValue * kernel[ky + 1][kx + 1];
                            }
                        }

                        if (kernelSum !== 0) {
                            sum = sum / kernelSum;
                        }

                        dst[dstIndex + c] = Math.max(0, Math.min(255, Math.round(sum)));
                    }
                }
            }

            currentY = endY;

            // Отдаём управление браузеру
            if (currentY < height) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        return result;
    }

    static _getPixel(src, width, height, x, y, channel, edgeMode) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
            return src[(y * width + x) * 4 + channel];
        }

        switch (edgeMode) {
            case 'black':
                return 0;
            case 'white':
                return 255;
            case 'clamp':
                const clampedX = Math.max(0, Math.min(x, width - 1));
                const clampedY = Math.max(0, Math.min(y, height - 1));
                return src[(clampedY * width + clampedX) * 4 + channel];
            default:
                return 0;
        }
    }
}