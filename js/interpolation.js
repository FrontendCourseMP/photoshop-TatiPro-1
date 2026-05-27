/**
 * Модуль двумерной интерполяции изображений
 * Поддерживает методы: nearestNeighbor (ближайший сосед), bilinear (билинейная)
 * Спроектирован для лёгкого добавления новых методов
 */
export class Interpolation {
    /**
     * Список доступных методов интерполяции
     */
    static get methods() {
        return {
            nearestNeighbor: {
                name: 'Ближайший сосед',
                description: 'Быстрый метод. Выбирает цвет ближайшего пикселя. Подходит для pixel-art и резких границ. Может давать ступенчатые артефакты при увеличении.',
                fn: 'nearestNeighbor'
            },
            bilinear: {
                name: 'Билинейная',
                description: 'Усредняет цвета 4 соседних пикселей. Даёт гладкий результат. Подходит для фотографий и плавных переходов. Незначительно размывает резкие границы.',
                fn: 'bilinear'
            }
        };
    }

    /**
     * Масштабирует изображение выбранным методом
     * @param {ImageData} sourceData - исходные данные
     * @param {number} newWidth - новая ширина
     * @param {number} newHeight - новая высота
     * @param {string} method - метод ('nearestNeighbor' или 'bilinear')
     * @returns {ImageData}
     */
    static scale(sourceData, newWidth, newHeight, method = 'bilinear') {
        const result = new ImageData(newWidth, newHeight);

        const scaleX = sourceData.width / newWidth;
        const scaleY = sourceData.height / newHeight;

        for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
                // Half-pixel correction: центры пикселей
                const srcX = (x + 0.5) * scaleX - 0.5;
                const srcY = (y + 0.5) * scaleY - 0.5;

                let r, g, b, a;

                if (method === 'nearestNeighbor') {
                    [r, g, b, a] = this.nearestNeighbor(sourceData, srcX, srcY);
                } else {
                    [r, g, b, a] = this.bilinear(sourceData, srcX, srcY);
                }

                const dstIndex = (y * newWidth + x) * 4;
                result.data[dstIndex] = r;
                result.data[dstIndex + 1] = g;
                result.data[dstIndex + 2] = b;
                result.data[dstIndex + 3] = a;
            }
        }

        return result;
    }

    /**
     * Метод ближайшего соседа
     * Берёт цвет пикселя, ближайшего к заданным координатам
     */
    static nearestNeighbor(sourceData, x, y) {
        const srcX = Math.round(x);
        const srcY = Math.round(y);

        const clampedX = Math.max(0, Math.min(srcX, sourceData.width - 1));
        const clampedY = Math.max(0, Math.min(srcY, sourceData.height - 1));

        const index = (clampedY * sourceData.width + clampedX) * 4;

        return [
            sourceData.data[index],
            sourceData.data[index + 1],
            sourceData.data[index + 2],
            sourceData.data[index + 3]
        ];
    }

    /**
     * Билинейная интерполяция
     * Усредняет цвета 4 соседних пикселей с весами по расстоянию
     */
    static bilinear(sourceData, x, y) {
        const x1Raw = Math.floor(x);
        const y1Raw = Math.floor(y);

        const x1 = Math.max(0, Math.min(x1Raw, sourceData.width - 1));
        const x2 = Math.max(0, Math.min(x1Raw + 1, sourceData.width - 1));
        const y1 = Math.max(0, Math.min(y1Raw, sourceData.height - 1));
        const y2 = Math.max(0, Math.min(y1Raw + 1, sourceData.height - 1));

        const dx = x - x1Raw;
        const dy = y - y1Raw;

        const i11 = (y1 * sourceData.width + x1) * 4;
        const i21 = (y1 * sourceData.width + x2) * 4;
        const i12 = (y2 * sourceData.width + x1) * 4;
        const i22 = (y2 * sourceData.width + x2) * 4;

        const result = [];
        for (let c = 0; c < 4; c++) {
            const top = sourceData.data[i11 + c] * (1 - dx) + sourceData.data[i21 + c] * dx;
            const bottom = sourceData.data[i12 + c] * (1 - dx) + sourceData.data[i22 + c] * dx;
            const value = top * (1 - dy) + bottom * dy;
            result.push(Math.round(value));
        }

        return result;
    }
}