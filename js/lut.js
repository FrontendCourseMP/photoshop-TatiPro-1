/**
 * Модуль таблиц подстановки (Look-Up Tables)
 * Используется для быстрого применения градационной коррекции
 * Вместо пересчёта каждого пикселя по формуле, 
 * мы один раз строим таблицу и потом просто подставляем значения
 */
export class LUT {
    constructor() {
        // Таблицы для каждого канала
        this.tables = {
            red: new Uint8Array(256),
            green: new Uint8Array(256),
            blue: new Uint8Array(256),
            alpha: new Uint8Array(256)
        };
        
        // Исходное состояние (identity LUT — без изменений)
        this.reset();
    }

    /**
     * Сбрасывает все таблицы в исходное состояние (без изменений)
     */
    reset() {
        ['red', 'green', 'blue', 'alpha'].forEach(channel => {
            for (let i = 0; i < 256; i++) {
                this.tables[channel][i] = i;
            }
        });
    }

    /**
     * Применяет уровни к таблице подстановки
     * @param {string} channel - 'master', 'red', 'green', 'blue', 'alpha'
     * @param {number} blackPoint - точка чёрного (0-254)
     * @param {number} whitePoint - точка белого (1-255)
     * @param {number} gamma - гамма-коррекция (0.1-9.9)
     */
    applyLevels(channel, blackPoint, whitePoint, gamma) {
        const channelsToApply = channel === 'master' 
            ? ['red', 'green', 'blue'] 
            : [channel];
        
        channelsToApply.forEach(ch => {
            const range = whitePoint - blackPoint;
            
            if (range <= 0) return; // Защита от деления на ноль
            
            for (let i = 0; i < 256; i++) {
                if (i <= blackPoint) {
                    // Всё что ниже точки чёрного — становится чёрным
                    this.tables[ch][i] = 0;
                } else if (i >= whitePoint) {
                    // Всё что выше точки белого — становится белым
                    this.tables[ch][i] = 255;
                } else {
                    // Линейное растяжение диапазона
                    let normalized = (i - blackPoint) / range; // 0..1
                    
                    // Применяем гамма-коррекцию
                    normalized = Math.pow(normalized, 1 / gamma);
                    
                    // Преобразуем обратно в 0..255
                    this.tables[ch][i] = Math.round(normalized * 255);
                }
            }
        });
    }

    /**
     * Применяет таблицы подстановки к ImageData
     * @param {ImageData} imageData - исходные данные изображения
     * @returns {ImageData} - новое изображение с применённой коррекцией
     */
    apply(imageData) {
        const result = new ImageData(
            new Uint8ClampedArray(imageData.data.length),
            imageData.width,
            imageData.height
        );
        
        const src = imageData.data;
        const dst = result.data;
        
        for (let i = 0; i < src.length; i += 4) {
            dst[i]     = this.tables.red[src[i]];       // R
            dst[i + 1] = this.tables.green[src[i + 1]]; // G
            dst[i + 2] = this.tables.blue[src[i + 2]];  // B
            dst[i + 3] = this.tables.alpha[src[i + 3]]; // A
        }
        
        return result;
    }
}