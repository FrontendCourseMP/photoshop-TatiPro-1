import { ColorSpaceConverter } from './colorSpace.js';

/**
 * Инструмент «Пипетка» для получения информации о цвете пикселя
 * При активации инструмента клик по холсту считывает цвет и координаты
 */
export class PipetteTool {
    /**
     * @param {HTMLCanvasElement} canvas - основной холст
     * @param {CanvasRenderingContext2D} ctx - контекст рисования
     */
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.active = false;
        
        // Колбэк, вызываемый при выборе цвета
        this.onColorPick = null;
        
        // Привязываем обработчик к экземпляру класса
        this.handleClick = this.handleClick.bind(this);
    }

    /**
     * Переключает состояние инструмента (активен/неактивен)
     * @returns {boolean} - новое состояние
     */
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

    /**
     * Деактивирует инструмент
     */
    deactivate() {
        if (this.active) {
            this.active = false;
            this.canvas.style.cursor = 'default';
            this.canvas.removeEventListener('click', this.handleClick);
        }
    }

    /**
     * Обработчик клика по холсту
     * Вычисляет координаты пикселя с учётом масштабирования CSS
     */
    handleClick(e) {
        if (!this.active) return;

        const rect = this.canvas.getBoundingClientRect();
        
        // Вычисляем масштабный коэффициент между реальным размером canvas
        // и его CSS-размером (холст может быть отмасштабирован)
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        // Переводим координаты клика в координаты изображения
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        // Проверяем, что координаты в пределах изображения
        if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {
            return;
        }
        
        // Считываем данные одного пикселя
        const pixelData = this.ctx.getImageData(x, y, 1, 1).data;
        const r = pixelData[0];
        const g = pixelData[1];
        const b = pixelData[2];
        const a = pixelData[3];
        
        // Конвертируем RGB в CIELAB
        const lab = ColorSpaceConverter.rgbToLab(r, g, b);
        
        // Формируем HEX-код цвета
        const hex = '#' + 
            r.toString(16).padStart(2, '0') + 
            g.toString(16).padStart(2, '0') + 
            b.toString(16).padStart(2, '0');
        
        // Передаём данные через колбэк
        if (this.onColorPick) {
            this.onColorPick({
                x: x,
                y: y,
                r: r,
                g: g,
                b: b,
                a: a,
                hex: hex.toUpperCase(),
                lab: {
                    L: lab.L,
                    a: lab.a,
                    b: lab.b
                }
            });
        }
    }
}