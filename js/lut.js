/**
 * Модуль таблиц подстановки (Look-Up Tables)
 * Используется для быстрого применения градационной коррекции
 * Поддерживает композицию: Master применяется ко всем цветовым каналам,
 * затем поверх применяются настройки конкретного канала.
 * Альфа-канал не проходит через Master.
 */
export class LUT {
    constructor() {
        this.tables = {
            red: new Uint8Array(256),
            green: new Uint8Array(256),
            blue: new Uint8Array(256),
            alpha: new Uint8Array(256)
        };

        // Храним параметры для каждого канала отдельно
        this.params = {
            master: { black: 0, white: 255, gamma: 1.0 },
            red:    { black: 0, white: 255, gamma: 1.0 },
            green:  { black: 0, white: 255, gamma: 1.0 },
            blue:   { black: 0, white: 255, gamma: 1.0 },
            alpha:  { black: 0, white: 255, gamma: 1.0 }
        };

        this.reset();
    }

    /**
     * Сбрасывает все таблицы в исходное состояние (без изменений)
     */
    reset() {
        Object.keys(this.params).forEach(ch => {
            this.params[ch] = { black: 0, white: 255, gamma: 1.0 };
        });
        this._rebuild();
    }

    /**
     * Сохраняет параметры для канала и пересобирает все таблицы
     * @param {string} channel - 'master', 'red', 'green', 'blue', 'alpha'
     * @param {number} blackPoint - точка чёрного (0-254)
     * @param {number} whitePoint - точка белого (1-255)
     * @param {number} gamma - гамма-коррекция (0.1-9.9)
     */
    setParams(channel, blackPoint, whitePoint, gamma) {
        this.params[channel] = {
            black: blackPoint,
            white: whitePoint,
            gamma: gamma
        };
        this._rebuild();
    }

    /**
     * Внутренний метод: пересобирает все 4 таблицы из текущих params.
     * Композиция: для red/green/blue сначала применяется master, потом per-channel.
     * Alpha не проходит через master.
     */
    _rebuild() {
        const masterLut = this._buildSingleLut(this.params.master);
        const redLut    = this._buildSingleLut(this.params.red);
        const greenLut  = this._buildSingleLut(this.params.green);
        const blueLut   = this._buildSingleLut(this.params.blue);
        const alphaLut  = this._buildSingleLut(this.params.alpha);

        // Композиция: out[i] = perChannel[master[i]]
        for (let i = 0; i < 256; i++) {
            this.tables.red[i]   = redLut[masterLut[i]];
            this.tables.green[i] = greenLut[masterLut[i]];
            this.tables.blue[i]  = blueLut[masterLut[i]];
            this.tables.alpha[i] = alphaLut[i]; // Alpha не идёт через master
        }
    }

    /**
     * Строит одну таблицу подстановки из параметров {black, white, gamma}
     * @param {{black: number, white: number, gamma: number}} params
     * @returns {Uint8Array}
     */
    _buildSingleLut({ black, white, gamma }) {
        const table = new Uint8Array(256);
        const range = white - black;

        for (let i = 0; i < 256; i++) {
            if (i <= black) {
                table[i] = 0;
            } else if (i >= white) {
                table[i] = 255;
            } else if (range > 0) {
                let normalized = (i - black) / range;
                normalized = Math.pow(normalized, 1 / gamma);
                table[i] = Math.round(normalized * 255);
            } else {
                table[i] = i;
            }
        }

        return table;
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
            dst[i]     = this.tables.red[src[i]];
            dst[i + 1] = this.tables.green[src[i + 1]];
            dst[i + 2] = this.tables.blue[src[i + 2]];
            dst[i + 3] = this.tables.alpha[src[i + 3]];
        }

        return result;
    }
}