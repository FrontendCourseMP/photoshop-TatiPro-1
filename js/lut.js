/**
 * Модуль таблиц подстановки (Look-Up Tables)
 * Композиция: Master → per-channel, Alpha независимо
 */
export class LUT {
    constructor() {
        this.tables = {
            red: new Uint8Array(256),
            green: new Uint8Array(256),
            blue: new Uint8Array(256),
            alpha: new Uint8Array(256)
        };

        this.params = {
            master: { black: 0, white: 255, gamma: 1.0 },
            red:    { black: 0, white: 255, gamma: 1.0 },
            green:  { black: 0, white: 255, gamma: 1.0 },
            blue:   { black: 0, white: 255, gamma: 1.0 },
            alpha:  { black: 0, white: 255, gamma: 1.0 }
        };

        this.reset();
    }

    reset() {
        Object.keys(this.params).forEach(ch => {
            this.params[ch] = { black: 0, white: 255, gamma: 1.0 };
        });
        this._rebuild();
    }

    setParams(channel, blackPoint, whitePoint, gamma) {
        this.params[channel] = {
            black: blackPoint,
            white: whitePoint,
            gamma: gamma
        };
        this._rebuild();
    }

    _rebuild() {
        const masterLut = this._buildSingleLut(this.params.master);
        const redLut    = this._buildSingleLut(this.params.red);
        const greenLut  = this._buildSingleLut(this.params.green);
        const blueLut   = this._buildSingleLut(this.params.blue);
        const alphaLut  = this._buildSingleLut(this.params.alpha);

        for (let i = 0; i < 256; i++) {
            this.tables.red[i]   = redLut[masterLut[i]];
            this.tables.green[i] = greenLut[masterLut[i]];
            this.tables.blue[i]  = blueLut[masterLut[i]];
            this.tables.alpha[i] = alphaLut[i];
        }
    }

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