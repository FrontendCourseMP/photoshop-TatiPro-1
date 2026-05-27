/**
 * Модуль управления цветовыми каналами изображения
 * Позволяет включать/отключать каналы и генерировать миниатюры превью
 */
export class ChannelManager {
    constructor() {
        // Состояние каналов: включены или выключены
        this.channels = {
            red: true,
            green: true,
            blue: true,
            alpha: true
        };

        // Оригинальные данные изображения (неизменяемые)
        this.originalImageData = null;
        
        // Количество каналов: 1 (gray), 2 (gray+alpha), 3 (RGB), 4 (RGBA)
        this.channelCount = 4;
    }

    /**
     * Загружает оригинальные данные изображения для работы с каналами
     * @param {ImageData} imageData - пиксельные данные с canvas
     * @param {number} channelCount - количество каналов (1, 2, 3, 4)
     */
    setOriginalImage(imageData, channelCount = 4) {
        // Создаём глубокую копию данных, чтобы никогда не менять оригинал
        this.originalImageData = new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );
        
        this.channelCount = channelCount;

        // Включаем только те каналы, которые есть в изображении
        this.channels.red = channelCount >= 3;
        this.channels.green = channelCount >= 3;
        this.channels.blue = channelCount >= 3;
        this.channels.alpha = (channelCount === 2 || channelCount === 4);
    }

    /**
     * Переключает состояние канала (вкл/выкл)
     * @param {string} channel - 'red', 'green', 'blue', 'alpha'
     * @returns {boolean} - новое состояние канала
     */
    toggleChannel(channel) {
        if (channel in this.channels) {
            this.channels[channel] = !this.channels[channel];
        }
        return this.channels[channel];
    }

    /**
     * Применяет состояние каналов и возвращает новое изображение
     * Выключенные каналы заменяются нулями (чёрный)
     * @returns {ImageData|null} - новое изображение с учётом состояния каналов
     */

        applyChannels() {
        if (!this.originalImageData) return null;

        const width = this.originalImageData.width;
        const height = this.originalImageData.height;
        const result = new ImageData(width, height);
        const src = this.originalImageData.data;
        const dst = result.data;

        // Особый случай: только альфа включена → показываем как маску (grayscale)
        const onlyAlpha = !this.channels.red && !this.channels.green
                       && !this.channels.blue && this.channels.alpha;
        
        if (onlyAlpha) {
            for (let i = 0; i < src.length; i += 4) {
                const a = src[i + 3];
                dst[i]     = a;
                dst[i + 1] = a;
                dst[i + 2] = a;
                dst[i + 3] = 255;
            }
            return result;
        }

        // Обычный путь: применяем включённые каналы
        for (let i = 0; i < src.length; i += 4) {
            dst[i]     = this.channels.red   ? src[i]     : 0;
            dst[i + 1] = this.channels.green ? src[i + 1] : 0;
            dst[i + 2] = this.channels.blue  ? src[i + 2] : 0;
            dst[i + 3] = this.channels.alpha ? src[i + 3] : 255;
        }

        return result;
    }


    /**
     * Генерирует превью отдельного канала в градациях серого
     * Белый означает максимальную интенсивность канала, чёрный — отсутствие
     * @param {string} channel - 'red', 'green', 'blue', 'alpha'
     * @returns {ImageData|null}
     */
    generateChannelPreview(channel) {
        if (!this.originalImageData) return null;

        const width = this.originalImageData.width;
        const height = this.originalImageData.height;
        const result = new ImageData(width, height);

        const src = this.originalImageData.data;
        const dst = result.data;

        let channelIndex;
        switch (channel) {
            case 'red':   channelIndex = 0; break;
            case 'green': channelIndex = 1; break;
            case 'blue':  channelIndex = 2; break;
            case 'alpha': channelIndex = 3; break;
            default: return null;
        }

        for (let i = 0; i < src.length; i += 4) {
            const value = src[i + channelIndex];
            // Отображаем канал в серых тонах
            dst[i]     = value; // R
            dst[i + 1] = value; // G
            dst[i + 2] = value; // B
            dst[i + 3] = 255;   // A (полностью непрозрачный)
        }

        return result;
    }

    /**
     * Создаёт уменьшенное превью для панели каналов
     * @param {string} channel - название канала
     * @param {number} previewWidth - ширина превью
     * @param {number} previewHeight - высота превью
     * @returns {HTMLCanvasElement} - canvas с превью канала
     */
    createPreviewCanvas(channel, previewWidth, previewHeight) {
        if (!this.originalImageData) return null;

        // Создаём временный canvas для масштабирования
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.originalImageData.width;
        tempCanvas.height = this.originalImageData.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(this.generateChannelPreview(channel), 0, 0);

        // Создаём уменьшенное превью
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = previewWidth;
        previewCanvas.height = previewHeight;
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx.drawImage(tempCanvas, 0, 0, previewWidth, previewHeight);

        return previewCanvas;
    }
}