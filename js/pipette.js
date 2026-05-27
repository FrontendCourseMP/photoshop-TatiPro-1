import { ColorSpaceConverter } from './colorSpace.js';

/**
 * Инструмент «Пипетка» для получения информации о цвете пикселя
 * Читает данные из ОРИГИНАЛЬНОГО изображения, а не с текущего canvas
 */
export class PipetteTool {
    /**
     * @param {HTMLCanvasElement} canvas - основной холст
     * @param {Object} channelManager - менеджер каналов с originalImageData
     */
    constructor(canvas, channelManager) {
        this.canvas = canvas;
        this.channelManager = channelManager;
        this.active = false;
        this.onColorPick = null;
        this.handleClick = this.handleClick.bind(this);
    }

    toggle() {
        this.active = !this.active;

        if (this.active) {
            this.canvas.style.cursor = 'crosshair';
            this.canvas.addEventListener('click', this.handleClick);
        } else {
            this.canvas.style.cursor = 'default';
            this.canvas.removeEventListener('click', this.handleClick);
        }

        return this.active;
    }

    deactivate() {
        if (this.active) {
            this.active = false;
            this.canvas.style.cursor = 'default';
            this.canvas.removeEventListener('click', this.handleClick);
        }
    }

    /**
     * Обработчик клика по холсту
     * Читает данные из оригинального изображения (не с canvas!)
     */
    handleClick(e) {
        if (!this.active) return;

        const rect = this.canvas.getBoundingClientRect();

        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {
            return;
        }

        // Читаем из ОРИГИНАЛЬНЫХ данных, не с canvas!
        const src = this.channelManager.originalImageData;
        if (!src) return;

        const offset = (y * src.width + x) * 4;
        const r = src.data[offset];
        const g = src.data[offset + 1];
        const b = src.data[offset + 2];
        const a = src.data[offset + 3];

        const lab = ColorSpaceConverter.rgbToLab(r, g, b);

        const hex = '#' +
            r.toString(16).padStart(2, '0') +
            g.toString(16).padStart(2, '0') +
            b.toString(16).padStart(2, '0');

        if (this.onColorPick) {
            this.onColorPick({
                x, y,
                r, g, b, a,
                hex: hex.toUpperCase(),
                lab: { L: lab.L, a: lab.a, b: lab.b }
            });
        }
    }
}